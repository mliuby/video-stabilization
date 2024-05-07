var currentEffect = null; // The current effect applying to the videos

var outputDuration = 0; // The duration of the output video
var outputFramesBuffer = []; // The frames buffer for the output video
var currentFrame = 0; // The current frame being processed
var completedFrames = 0; // The number of completed frames
var current = 0; // The current frame when processing motion vectors
var completed = 0; 
var motionVectors = [];
var otherVectors = [];
var smoothened_vectors = [];
var new_left=0;
var new_right=0;
var new_top=0;
var new_bottom=0;

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
            const start = Math.max(0, i - num_steps);
            var sum_x = 0;
            var sum_y = 0;           
            for (let j = start; j <= i; j++) {
                sum_x += motionVectors[j].x;
                sum_y += motionVectors[j].y;
            }
        
            var average_x = sum_x / (i - start + 1);
            var average_y = sum_y / (i - start + 1);
            smoothened_vectors[i]={x:average_x, y:average_y};
        }
        
        for (var i=0; i<motionVectors.length; ++i){
            motionVectors[i].x=parseInt(smoothened_vectors[i].x-motionVectors[i].x);
            motionVectors[i].y=parseInt(smoothened_vectors[i].y-motionVectors[i].y);
            new_right=(motionVectors[i].x<0 && motionVectors[i].x<new_right)?motionVectors[i].x:new_right;
            new_left=(motionVectors[i].x>0 && motionVectors[i].x>new_left)?motionVectors[i].x:new_left;
            new_top=(motionVectors[i].y>0 && motionVectors[i].y>new_top)?motionVectors[i].y:new_top;
            new_bottom=(motionVectors[i].y<0 && motionVectors[i].y<new_bottom)?motionVectors[i].y:new_bottom;

        }
        for (var i=0; i<otherVectors.length;++i){
            for (var k=0;k<4;k++){
                otherVectors[i][k].x+=motionVectors[i].x;
                otherVectors[i][k].y+=motionVectors[i].y;
            }
        }
        currentFrame = 0;
        completedFrames = 0;
        processFrame();
    }
}


// track motion vectors  between frames
function motionEstimation(referenceFrame, searchFrame, blockSize, searchAreaSize, stride, h, w) {
    let motionVector = { x: 0, y: 0 };
    let otherVector = [];
    var x=Math.floor((w-blockSize)/2);
    var y=Math.floor((h-blockSize)/2);
    let min = Infinity;
    var count = 0;
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
                    count++;
                }
            }
            if (sum/count < min) {
                min = sum/count;
                motionVector.x=i;
                motionVector.y=j;
            }
        }
    }
    var xs = [Math.floor((w-3*blockSize)/2), Math.floor((w+blockSize)/2), Math.floor((w-3*blockSize)/2), Math.floor((w+blockSize)/2)];
    var ys = [Math.floor((h-3*blockSize)/2), Math.floor((h-3*blockSize)/2), Math.floor((h+blockSize)/2), Math.floor((h+blockSize)/2)];
    for (var k=0;k<4;k++){
        var x = xs[k];
        var y = ys[k];
        let min = Infinity;
        var count = 0;
        var tempt;
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
                        count++;
                    }
                }
                if (sum/count < min) {
                    min = sum/count;
                    tempt = {x:i,y:j};
                }
            }
        }
        otherVector.push(tempt);
    }
    console.log("otherVector" ,otherVector);
    return [motionVector, otherVector];
}

function getPixelValue(imageData, x, y, h, w) {
    var numChannels = 4; // Assuming RGB color model
    var index = (y * w + x) * numChannels;
    var R = imageData.data[index];
    var G = imageData.data[index + 1];
    var B = imageData.data[index + 2];
    return (R + G + B) / 3;
}

function drawArrow(ctx, x, y, a, b) {
    var arrowSize = 10; // Size of the arrowhead
    var startX = x; // Starting point of the arrow
    var startY = y;
    var magnitude = Math.hypot(a, b);
    var endX = startX + (a / magnitude) * 30;
    var endY = startY + (b / magnitude) * 30;
  
    ctx.strokeStyle = '#f00'; // Set the stroke color to red
    ctx.lineWidth = 5; // Set the line width
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  
    ctx.fillStyle = '#f00'; // Set the fill color to red
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - (arrowSize * a / magnitude) + (arrowSize * b / magnitude),
      endY - (arrowSize * b / magnitude) - (arrowSize * a / magnitude)
    );
    ctx.lineTo(
      endX - (arrowSize * a / magnitude) - (arrowSize * b / magnitude),
      endY - (arrowSize * b / magnitude) + (arrowSize * a / magnitude)
    );
    ctx.lineTo(endX, endY);
    ctx.fill();
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
            otherVectors = new Array(outputDuration); 
            for (var i = 0; i < outputDuration; i++) {
                otherVectors[i] = []; 
            }       
        },
        getmotionVectors: function(i) {
            if(i==0){
                motionVectors[0]={ x: 0, y: 0 };
                for (var k=0;k<4;k++)
                    otherVectors[0].push({x:0 , y:0});
                finishVectors();  
            }
            else{
                var blockSize=parseInt($("#stabilization-blocks").val());       
                var searchAreaSize = 50;
                var stride = 5;         

                var w = $("#input-video-1").get(0).videoWidth;
                var h = $("#input-video-1").get(0).videoHeight;
                var canvas = getCanvas(w, h);
                var ctx = canvas.getContext('2d',{ willReadFrequently: true });

                var img_ref = new Image();
                var img_search = new Image();
                img_ref.onload = function () {
                    ctx.drawImage(img_ref, 0, 0);
                    var imageData_ref = ctx.getImageData(0, 0, w, h);   
                    img_search.onload = function () {
                        ctx.drawImage(img_search, 0, 0);
                        var imageData_search = ctx.getImageData(0, 0, w, h);
                        var result = motionEstimation(imageData_ref, imageData_search, blockSize, searchAreaSize, stride, h, w);
                        motionVectors[i]=result[0];
                        otherVectors[i]=result[1];
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
            var if_crop=$("#crop").is(":checked");
            var if_display=$("#motion_vector").is(":checked");
            var blockSize=parseInt($("#stabilization-blocks").val());       
            var w = $("#input-video-1").get(0).videoWidth;
            var h = $("#input-video-1").get(0).videoHeight;
            var canvas1 = getCanvas(w, h);
            var canvas2 = getCanvas(w, h);
            var ctx1 = canvas1.getContext('2d', { willReadFrequently: true });
            var ctx2 = canvas2.getContext('2d', { willReadFrequently: true });
            var dx = motionVectors[idx].x;
            var dy = motionVectors[idx].y;
            var xs = [Math.floor((w-2*blockSize)/2), Math.floor((w+2*blockSize)/2), Math.floor((w-2*blockSize)/2), Math.floor((w+2*blockSize)/2)];
            var ys = [Math.floor((h-2*blockSize)/2), Math.floor((h-2*blockSize)/2), Math.floor((h+2*blockSize)/2), Math.floor((h+2*blockSize)/2)];
        
            if(if_crop){
                var canvas3 = getCanvas(w+new_right-new_left, h+new_bottom-new_top);
                var ctx3 = canvas3.getContext('2d', { willReadFrequently: true });
            }

            if(if_copy){
                var img_prev = new Image();
                var img_cur = new Image();
                
                img_prev.onload = function () {
                    ctx1.drawImage(img_prev, 0, 0);
                    img_cur.onload = function () {
                        ctx2.drawImage(img_prev, 0, 0);
                        var imageData_prev = ctx2.getImageData(0, 0, w, h);
                        ctx1.putImageData(imageData_prev, dx, dy);
                        if(if_display){
                            drawArrow(ctx1, w/2+dx, h/2+dy, dx, dy)
                            for(var k=0;k<4;k++){
                                var dxk=otherVectors[idx][k].x;
                                var dyk=otherVectors[idx][k].y;
                                drawArrow(ctx1, xs[k]+dx, ys[k]+dy, dxk, dyk);
                            }
                        }
                        outputFramesBuffer[idx] = canvas1.toDataURL("image/webp");
                        finishFrame();
                    };
                    img_cur.src = input1FramesBuffer[idx];
                }
                img_prev.src = input1FramesBuffer[idx-1];
                
            }
            else if(if_crop){
                var img = new Image();
                img.onload = function() {
                    ctx2.drawImage(img, 0, 0);
                    var img_data = ctx2.getImageData(0, 0, w, h);
                    ctx3.putImageData(img_data, dx-new_left, dy-new_top);
                    if(if_display){
                        drawArrow(ctx3, w/2+dx, h/2+dy, dx, dy);
                        for(var k=0;k<4;k++){
                            var dxk=otherVectors[idx][k].x;
                            var dyk=otherVectors[idx][k].y;
                            drawArrow(ctx1, xs[k]+dx, ys[k]+dy, dxk, dyk);
                        }
                    }
                    outputFramesBuffer[idx] = canvas3.toDataURL("image/webp");
                    finishFrame();
                };
                img.src = input1FramesBuffer[idx];     
            }
            else{        
                var img = new Image();
                img.onload = function() {
                    ctx2.drawImage(img, 0, 0);
                    var img_data = ctx2.getImageData(0, 0, w, h);
                    ctx1.putImageData(img_data, dx, dy);
                    if(if_display){
                        drawArrow(ctx1, w/2+dx, h/2+dy, dx, dy);
                        for(var k=0;k<4;k++){
                            var dxk=otherVectors[idx][k].x;
                            var dyk=otherVectors[idx][k].y;
                            drawArrow(ctx1, xs[k]+dx, ys[k]+dy, dxk, dyk);
                        }
                    }
                    outputFramesBuffer[idx] = canvas1.toDataURL("image/webp");
                    finishFrame();
                };
                img.src = input1FramesBuffer[idx];          
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
