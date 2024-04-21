var currentEffect = null; // The current effect applying to the videos

var outputDuration = 0; // The duration of the output video
var outputFramesBuffer = []; // The frames buffer for the output video
var currentFrame = 0; // The current frame being processed
var completedFrames = 0; // The number of completed frames

// This function starts the processing of an individual frame.
function processFrame() {
    if (currentFrame < outputDuration) {
        currentEffect.process(currentFrame);
        currentFrame++;
    }
}

// This function is called when an individual frame is finished.
// If all frames are completed, it takes the frames stored in the
// `outputFramesBuffer` and builds a video. The video is then set as the 'src'
// of the <video id='output-video'></video>.
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

// Definition of various video effects
//
// `effects` is an object with unlimited number of members.
// Each member of `effects` represents an effect.
// Each effect is an object, with two member functions:
// - setup() which responsible for gathering different parameters
//           of that effect and preparing the output buffer
// - process() which responsible for processing of individual frame
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
        default:
            // Do nothing
            $("#progress-modal").modal("hide");
            return;
    }

    // Set up the effect
    currentEffect.setup();

    // Start processing the frames
    currentFrame = 0;
    completedFrames = 0;
    processFrame();
}
