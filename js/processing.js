var currentEffect = null; // The current effect applying to the videos

var outputDuration = 0; // The duration of the output video
var outputFramesBuffer = []; // The frames buffer for the output video
var currentFrame = 0; // The current frame being processed
var completedFrames = 0; // The number of completed frames
var current = 0; // The current frame when processing motion vectors
var completed = 0; 
var motionVectors = [];
var smoothened_vectors = [];

function processFrame() {
    if (currentFrame < outputDuration) {
        currentEffect.process(currentFrame);
        currentFrame++;
    }
}

function processVectors() {
    if (current < outputDuration) {
        currentEffect.getmotionVectors(current);
        current++;
    }
}

function finishFrame() {
    completedFrames++;
    if (completedFrames < outputDuration) {
        updateProgressBar("#effect-progress", completedFrames / outputDuration * 100);

        if (stopProcessingFlag) {
            stopProcessingFlag = false;
            $("#progress-modal").modal("hide");
        } else {
            setTimeout(processFrame, 1);
        }
    }
    else {
        buildVideo(outputFramesBuffer, function(resultVideo) {
            $("#output-video").attr("src", URL.createObjectURL(resultVideo));
            updateProgressBar("#effect-progress", 100);
            $("#progress-modal").modal("hide");
        });
    }
}

function finishVectors() {
    
    completed++;
    if (completed < outputDuration) {
        updateProgressBar("#effect-progress", completed / outputDuration * 100);

        if (stopProcessingFlag) {
            stopProcessingFlag = false;
            $("#progress-modal").modal("hide");
        } else {
            setTimeout(processVectors, 1);
        }
    }
    else {
        var num_steps=parseInt($("#stabilization-smoothen-steps").val());
        for (var i=1; i<motionVectors.length; i++){ // global path
            motionVectors[i].x+=motionVectors[i-1].x;
            motionVectors[i].y+=motionVectors[i-1].y;
        }

        for (let i = 0; i < motionVectors.length; i++) { // smoothen
            const start = Math.max(0, i - Math.floor(num_steps / 2));
            const end = Math.min(motionVectors.length - 1, i + Math.ceil(num_steps / 2));
            var sum_x = 0;
            var sum_y = 0;           
            for (let j = start; j <= end; j++) {
                sum_x += motionVectors[j].x;
                sum_y += motionVectors[j].y;
            }
        
            var average_x = sum_x / (end - start + 1);
            var average_y = sum_y / (end - start + 1);
            smoothened_vectors[i]={x:average_x, y:average_y};
        }
        console.log(motionVectors.length)
        console.log(smoothened_vectors.length)
        for (var i=0; i<motionVectors.length; ++i){
            motionVectors[i].x=smoothened_vectors[i].x-motionVectors[i].x;
            motionVectors[i].y=smoothened_vectors[i].y-motionVectors[i].y;
        }

        currentFrame = 0;
        completedFrames = 0;
        processFrame();
    }
}


// track motion vectors  between frames
function motionEstimation(referenceFrame, searchFrame, blockSize, searchAreaSize, stride, h, w) {
    let motionVector = { x: 0, y: 0 };
    let min = Infinity;
    for (var x = 0; x + blockSize < w; x += blockSize) {
        for (var y = 0; y + blockSize < h; y += blockSize) {
            for (let i = -searchAreaSize; i <= searchAreaSize; i += stride) {
                for (let j = -searchAreaSize; j <= searchAreaSize; j += stride) {
                    var sum = 0;
                    if (x + i - blockSize < 0 || x + i + blockSize >= w || y + j - blockSize < 0 || y + j + blockSize >= h)
                        continue;
                    for (var bx = 0; bx < blockSize; bx++) {
                        for (var by = 0; by < blockSize; by++) {
                            var referencePixel = getPixelValue(referenceFrame, x + bx, y + by, h, w);
                            var searchPixel = getPixelValue(searchFrame, x + i + bx, y + j + by, h, w);
                            sum += Math.pow(referencePixel - searchPixel, 2);
                        }
                    }
                    if (sum < min) {
                        min = sum;
                        motionVector.x = i;
                        motionVector.y = j;
                    }
                }
            }
        }
    }    
    return motionVector;
}

function getPixelValue(imageData, x, y, h, w) {
    var numChannels = 4; // Assuming RGB color model
    var index = (y * w + x) * numChannels;
    var R = imageData.data[index];
    var G = imageData.data[index + 1];
    var B = imageData.data[index + 2];
    return (R + G + B) / 3;
}

var effects = {
    reverse: {
        setup: function() {
            // Initialize the duration of the output video
            outputDuration = input1FramesBuffer.length;

            // Prepare the array for storing the output frames
            outputFramesBuffer = new Array(outputDuration);
        },
        process: function(idx) {
            // Put the frames in reverse order
            outputFramesBuffer[idx] = input1FramesBuffer[(outputDuration - 1) - idx];

            // Notify the finish of a frame
            finishFrame();
        }
    },
    
    fadeInOut: {
        setup: function() {
            // Prepare the parameters
            this.fadeInDuration = Math.round(parseFloat($("#fadeIn-duration").val()) * frameRate);
            this.fadeOutDuration = Math.round(parseFloat($("#fadeOut-duration").val()) * frameRate);

            // Initialize the duration of the output video
            outputDuration = input1FramesBuffer.length;

            // Prepare the array for storing the output frames
            outputFramesBuffer = new Array(outputDuration);
        },
        process: function(idx) {
            // Use a canvas to store frame content
            var w = $("#input-video-1").get(0).videoWidth;
            var h = $("#input-video-1").get(0).videoHeight;
            var canvas = getCanvas(w, h);
            var ctx = canvas.getContext('2d');
            

            /*
             * TODO: Calculate the multiplier
             */
            var multiplier = 1;
            if(idx<this.fadeInDuration)
                multiplier=idx/this.fadeInDuration;
            else if (idx>outputDuration-this.fadeOutDuration)
                multiplier=(outputDuration-idx)/this.fadeOutDuration;

            // Modify the image content based on the multiplier
            var img = new Image();
            img.onload = function() {
                // Get the image data object
                ctx.drawImage(img, 0, 0);
                var imageData = ctx.getImageData(0, 0, w, h);


                /*
                 * TODO: Modify the pixels
                 */
                for (var i=0; i<imageData.data.length; i+=4){
                    imageData.data[i]*=multiplier;
                    imageData.data[i+1]*=multiplier;
                    imageData.data[i+2]*=multiplier;
                }
                
                // Store the image data as an output frame
                ctx.putImageData(imageData, 0, 0);
                outputFramesBuffer[idx] = canvas.toDataURL("image/webp");

                // Notify the finish of a frame
                finishFrame();
            };
            img.src = input1FramesBuffer[idx];
        }
    },
    
    motionBlur: {
        setup: function() {
            // Prepare the parameters
            this.blurFrames = parseInt($("#blur-frames").val());

            // Initialize the duration of the output video
            outputDuration = input1FramesBuffer.length;

            // Prepare the array for storing the output frames
            outputFramesBuffer = new Array(outputDuration);

            // Prepare a buffer of frames (as ImageData)
            this.imageDataBuffer = [];
        },
        process: function(idx, parameters) {
            // Use a canvas to store frame content
            var w = $("#input-video-1").get(0).videoWidth;
            var h = $("#input-video-1").get(0).videoHeight;
            var canvas = getCanvas(w, h);
            var ctx = canvas.getContext('2d');
            
            // Need to store them as local variables so that
            // img.onload can access them
            var imageDataBuffer = this.imageDataBuffer;
            var blurFrames = this.blurFrames;

            // Combine frames into one
            var img = new Image();
            img.onload = function() {
                // Get the image data object of the current frame
                ctx.drawImage(img, 0, 0);
                var imageData = ctx.getImageData(0, 0, w, h);
                /*
                 * TODO: Manage the image data buffer
                 */
                imageDataBuffer.push(imageData);
                if(imageDataBuffer.length>blurFrames)
                    imageDataBuffer.shift();


                // Create a blank image data
                imageData = new ImageData(w, h);
                for (var i=0; i<imageData.data.length; i+=4){
                    imageData.data[i]=0;
                    imageData.data[i+1]=0;
                    imageData.data[i+2]=0;
                    imageData.data[i+3]=255;
                    for (var j=0; j<imageDataBuffer.length;++j){
                        imageData.data[i]+=imageDataBuffer[j].data[i]/imageDataBuffer.length;
                        imageData.data[i+1]+=imageDataBuffer[j].data[i+1]/imageDataBuffer.length;
                        imageData.data[i+2]+=imageDataBuffer[j].data[i+2]/imageDataBuffer.length;
                    }
                }


                /*
                 * TODO: Combine the image data buffer into one frame
                 */


                // Store the image data as an output frame
                ctx.putImageData(imageData, 0, 0);
                outputFramesBuffer[idx] = canvas.toDataURL("image/webp");

                // Notify the finish of a frame
                finishFrame();
            };
            img.src = input1FramesBuffer[idx];
        }
    },
    earthquake: {
        setup: function() {
            // Prepare the parameters
            this.strength = parseInt($("#earthquake-strength").val());

            // Initialize the duration of the output video
            outputDuration = input1FramesBuffer.length;

            // Prepare the array for storing the output frames
            outputFramesBuffer = new Array(outputDuration);
        },
        process: function(idx, parameters) {
            // Use a canvas to store frame content
            var w = $("#input-video-1").get(0).videoWidth;
            var h = $("#input-video-1").get(0).videoHeight;
            var canvas = getCanvas(w, h);
            var ctx = canvas.getContext('2d');
            

            /*
             * TODO: Calculate the placement of the output frame
             */
            var dx = Math.floor(Math.random() * 2 * this.strength);
            var dy = Math.floor(Math.random() * 2 * this.strength);
            var sw = w-2*this.strength;
            var sh = h-2*this.strength;

            // Draw the input frame in a new location and size
            var img = new Image();
            img.onload = function() {
            
                
                /*
                 * TODO: Draw the input frame appropriately
                 */
                ctx.drawImage(img, dx,dy,sw,sh,0,0,w,h);


                outputFramesBuffer[idx] = canvas.toDataURL("image/webp");

                // Notify the finish of a frame
                finishFrame();
            };
            img.src = input1FramesBuffer[idx];
        }
    },
    crossFade: {
        setup: function() {
            // Prepare the parameters
            this.crossFadeDuration = Math.round(parseFloat($("#crossFade-duration").val()) * frameRate);
        
            // Initialize the duration of the output video
            outputDuration = input1FramesBuffer.length + input2FramesBuffer.length - this.crossFadeDuration;
        
            // Prepare the array for storing the output frames
            outputFramesBuffer = new Array(outputDuration);
        },
        process: function(idx) {

            if (idx < input1FramesBuffer.length - this.crossFadeDuration) {
                outputFramesBuffer[idx] = input1FramesBuffer[idx];
            } 
            else if (input1FramesBuffer.length - this.crossFadeDuration<=idx && idx < input1FramesBuffer.length) {
                var transitionIdx = idx - (input1FramesBuffer.length - this.crossFadeDuration);
                var multiplier = 1 - transitionIdx / this.crossFadeDuration;
        
                var w = $("#input-video-1").get(0).videoWidth;
                var h = $("#input-video-1").get(0).videoHeight;
                var canvas = getCanvas(w, h);
                var ctx = canvas.getContext('2d');
                var crossFadeDuration = this.crossFadeDuration;
                var img1 = new Image();
                var img2 = new Image();
                img1.onload = function() {
                    ctx.drawImage(img1, 0, 0);
                    var imageData1 = ctx.getImageData(0, 0, w, h);

                    img2.onload = function() {
                        ctx.drawImage(img2, 0, 0);
                        var imageData2 = ctx.getImageData(0, 0, w, h);
                        for (var i = 0; i < imageData1.data.length; i += 4) {
                        imageData1.data[i] = imageData1.data[i] * multiplier + imageData2.data[i] * (1 - multiplier);
                        imageData1.data[i + 1] = imageData1.data[i + 1] * multiplier + imageData2.data[i + 1] * (1 - multiplier);
                        imageData1.data[i + 2] = imageData1.data[i + 2] * multiplier + imageData2.data[i + 2] * (1 - multiplier);
                        imageData1.data[i + 3] = imageData1.data[i + 3] * multiplier + imageData2.data[i + 3] * (1 - multiplier);
                        }

                        // Store the image data as an output frame
                        ctx.putImageData(imageData1, 0, 0);
                        outputFramesBuffer[idx] = canvas.toDataURL("image/webp");
                    };
                    img2.src = input2FramesBuffer[idx - input1FramesBuffer.length + crossFadeDuration]; 
                };

                img1.src = input1FramesBuffer[idx];
            } 
            else {
                // Copy the frame from input video 2 to the output frame
                var transitionIdx = idx - input1FramesBuffer.length + this.crossFadeDuration;
                outputFramesBuffer[idx] = input2FramesBuffer[transitionIdx];
            }
            finishFrame();
        }    
    },
    stabilization:{
        setup: function() {
            outputDuration=input1FramesBuffer.length;
            outputFramesBuffer = new Array(outputDuration);
            motionVectors = new Array(outputDuration);
            smoothened_vectors = new Array(outputDuration);
            
        },
        getmotionVectors: function(i) {
            if(i==0){
                motionVectors[0]={ x: 0, y: 0 };
                finishVectors();  
            }
            else{
                var blockSize=parseInt($("#stabilization-blocks").val());        
                var searchAreaSize = 10;
                var stride = 2;         

                var w = $("#input-video-1").get(0).videoWidth;
                var h = $("#input-video-1").get(0).videoHeight;
                var canvas = getCanvas(w, h);
                var ctx = canvas.getContext('2d');
            
                var img_ref = new Image();
                var img_search = new Image();
                img_ref.onload = function () {
                    ctx.drawImage(img_ref, 0, 0);
                    var imageData_ref = ctx.getImageData(0, 0, w, h);   
                    img_search.onload = function () {
                        ctx.drawImage(img_search, 0, 0);
                        var imageData_search = ctx.getImageData(0, 0, w, h);
                        motionVectors[i] = motionEstimation(
                            imageData_ref,
                            imageData_search,
                            searchAreaSize,
                            blockSize,
                            stride,
                            w,
                            h
                        );
                        finishVectors();    
                    };
                    img_search.src = input1FramesBuffer[i];
                };
                img_ref.src = input1FramesBuffer[i-1];
            }

        },

        process: function(idx) {
            // Use a canvas to store frame content
            var if_copy=$("#copy").is(":checked");
            var if_display=$("#motion_vector").is(":checked");
            var w = $("#input-video-1").get(0).videoWidth;
            var h = $("#input-video-1").get(0).videoHeight;
            var canvas = getCanvas(w, h);
            var ctx = canvas.getContext('2d', { willReadFrequently: true });
            var dx = motionVectors[idx].x;
            var dy = motionVectors[idx].y;
            if (idx==0){
                outputFramesBuffer[0]=input1FramesBuffer[0];
                finishFrame();
            }
            else{
                var img_prev = new Image();
                var img_cur = new Image();
                
                img_prev.onload = function () {
                  ctx.drawImage(img_prev, 0, 0);
                  var imageData_prev = ctx.getImageData(0, 0, w, h);
                
                  img_cur.onload = function () {
                    ctx.drawImage(img_cur, 0, 0);
                    var imageData_cur = ctx.getImageData(0, 0, w, h);
                    var imageData_shifted = ctx.createImageData(w, h);
                
                    for (let y = 0; y < h; y++) {
                      for (let x = 0; x < w; x++) {
                        var destIndex = (y * w + x) * 4;
                        var srcX = x - dx;
                        var srcY = y - dy;
                
                        if (srcX >= 0 && srcX < w && srcY >= 0 && srcY < h) {
                          var srcIndex = (srcY * w + srcX) * 4;
                
                          for (let i = 0; i < 4; i++) {
                            imageData_shifted.data[destIndex + i] = imageData_cur.data[srcIndex + i];
                          }
                        } else if (if_copy) {
                          for (let i = 0; i < 4; i++) {
                            imageData_shifted.data[destIndex + i] = imageData_prev.data[destIndex + i];
                          }
                        } else {
                          imageData_shifted.data[destIndex] = 0;
                          imageData_shifted.data[destIndex + 1] = 0;
                          imageData_shifted.data[destIndex + 2] = 0;
                          imageData_shifted.data[destIndex + 3] = 255;
                        }
                      }
                    }
                
                    ctx.putImageData(imageData_shifted, 0, 0);
                    outputFramesBuffer[idx] = canvas.toDataURL("image/webp");
                    finishFrame();
                  };
                
                  img_cur.src = input1FramesBuffer[idx];
                };
                
                img_prev.src = input1FramesBuffer[idx - 1];          
            }
        }

    }
}

// Handler for the "Apply" button click event
function applyEffect(e) {
    $("#progress-modal").modal("show");
    updateProgressBar("#effect-progress", 0);

    // Check which one is the actively selected effect
    switch(selectedEffect) {
        case "fadeInOut":
            currentEffect = effects.fadeInOut;
            break;
        case "reverse":
            currentEffect = effects.reverse;
            break;
        case "motionBlur":
            currentEffect = effects.motionBlur;
            break;
        case "earthquake":
            currentEffect = effects.earthquake;
            break;
        case "crossFade":
            currentEffect = effects.crossFade;
            break;
        case "stabilization":
            currentEffect= effects.stabilization;
            break;
        default:
            // Do nothing
            $("#progress-modal").modal("hide");
            return;
    }

    // Set up the effect
    currentEffect.setup();
    if(selectedEffect=="stabilization"){
        current = 0;
        completed = 0;
        processVectors();

    }
    else{  
    // Start processing the frames
    currentFrame = 0;
    completedFrames = 0;
    processFrame();
    }
}
