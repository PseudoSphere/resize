import React from 'react';
import './App.css';

import pdfkit from 'pdfkit/js/pdfkit.standalone.js';
import blobStream from 'blob-stream';

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      raw: null,
      display: {
        src: null,
        default: true
      },
      scrollTop: 0,
      scrollLeft: 0,
      resizedImage: {
        src: null,
        width: 0,
        height: 0
      },
      physicalDistance: '',
      scale: 4,
      start: {
        location: [0,0],
        updated: false,
        message: "Select Start"
      },
      end: {
        location: [0,0],
        updated: false,
        message: "Select End"
      },
      chooseStart: true,
      zoomFactor: 0,
      download: false
    }
    this.pdfPoints = 72;
  }

  // in charge of choosing initial image
  updateDisplayImage(event) {
    const file = event.target.files[0];
    if(!file) {
      return;
    }

    const raw = new Image();
    const imageURL = URL.createObjectURL(file);
    raw.src = imageURL;
    this.setState({
      raw,
      display: {
        src: imageURL,
        default: false
      },
      start: {
        location: [0,0],
        updated: false,
        message: "Select Start"
      },
      end: {
        location: [0,0],
        updated: false,
        message: "Select End"
      },
      download: false,
      chooseStart: true
    })
  }

  // resizes the image if prereqs are met
  resize() {
    if(this.state.display.default) {
      alert("You must select an image first");
      return;
    }
    if(!this.state.start.updated) {
      alert("You must select a starting point");
      return;
    }
    if(!this.state.end.updated) {
      alert("You must select an ending point");
      return;
    }
    if(this.state.physicalDistance <= 0) {
      alert("You must set physical distance");
      return;
    }

    /* 
      Calculate Scale Factor
    */
    // clac length of selection in pixels
    const xPixels = this.state.start.location[0] - this.state.end.location[0];
    const yPixels = this.state.start.location[1] - this.state.end.location[1];
    let pixels = Math.sqrt(Math.pow(xPixels, 2) + Math.pow(yPixels, 2));

    // convert size to pdf points (72 per inch)
    let paperDistance = pixels/this.pdfPoints;

    // calc scale
    let zoomFactor = this.state.physicalDistance/paperDistance/this.state.scale;
    let fullWidth = this.state.raw.width * zoomFactor;
    let fullHeight = this.state.raw.height * zoomFactor;
    let margin = 2 * this.pdfPoints

    // create image/file
    let pdf = new pdfkit({
      //layout,
      size: [fullWidth + margin, fullHeight + margin]
    });
    const stream = pdf.pipe(blobStream());

    let canvas = document.createElement('canvas');
    let image = this.state.raw
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    let data = canvas.toDataURL();
  
    // fill pdf
    pdf.image(data, margin/2, margin/2, {width: fullWidth});

    // prepare for save
    pdf.end();
    stream.on("finish", () => {
      // get a blob URL for download
      const url = stream.toBlobURL("application/pdf");
      
      this.setState({
        resizedImage: {
          src: url,
          width: fullWidth,
          height: fullHeight
        },
        zoomFactor,
        download: true
      })
    });
  }

  /* 
    input trackers 
  */
  updatePhysical(event) {
    this.setState({
      physicalDistance: event.target.value,
      download: false
    });
  }

  updateScale(event) {
    this.setState({
      scale: event.target.value,
      download: false
    })
  }


  // sets the next chosen point to be the "start" of the line
  startActive() {
    this.setState({
      chooseStart: true
    });
  }

  // sets the next chosen point to be the "end" of the line
  endActive() {
    this.setState({
      chooseStart: false
    });
  }

  // updates the selections on the display image
  updateDisplay(event) {
    let focus = event.target;
    if(focus.tagName !== 'IMG') {
      return;
    }
    
    // get distance of point relative to image
    let el = focus;
    for (var lx=0, ly=0;
          el != null;
          lx += el.offsetLeft, ly += el.offsetTop, el = el.offsetParent);
    let clickedX = event.pageX - lx + this.state.scrollLeft;
    let clickedY = event.pageY - ly + this.state.scrollTop;
    
    // update state and redraw
    if(this.state.chooseStart) {
      // first time selection will auto move to select end
      if(!this.state.start.updated) {
        this.setState({
          chooseStart: false
        });
      }
      this.setState({
        start: {
          message: "Re-select Start",
          updated: true,
          location: [clickedX, clickedY]
        },
      }, this._redrawDisplay)
    } else {
      this.setState({
        end: {
          message: "Re-select End",
          updated: true,
          location: [clickedX, clickedY]
        },
      }, this._redrawDisplay)
    }
  }
  // update the display based on current(updated) state
  _redrawDisplay() {
    let drawLine = true;
    // set up canvas
    let canvas = document.createElement('canvas');
    let image = this.state.raw;
    canvas.width = image.width;
    canvas.height = image.height;
    let context = canvas.getContext("2d");
    context.lineWidth = 5;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    // draw start
    if(this.state.start.updated) {
      this._drawPoint(canvas, this.state.start.location);
    } else {
      drawLine = false;
    }

    // draw end
    if(this.state.end.updated) {
      this._drawPoint(canvas, this.state.end.location);
    } else {
      drawLine = false;
    }

    // draw line
    if(drawLine) {
      context.beginPath();
      let startLocation = this.state.start.location;
      let endLocation = this.state.end.location;
      context.moveTo(startLocation[0], startLocation[1]);
      context.lineTo(endLocation[0], endLocation[1]);
      context.stroke();
    }

    // update state
    this.setState({
      display: {
        src: canvas.toDataURL("image/jpeg"),
        default: false
      },
      download: false
    });
  }
  // for uniform poing representations
  _drawPoint(canvas, location) {
    let context = canvas.getContext("2d");
    // Inner
    context.beginPath();
    context.arc(location[0], location[1], 5, 0, 2*Math.PI);
    context.fill();

    // Outer
    context.beginPath();
    context.arc(location[0], location[1], 20, 0, 2*Math.PI);
    context.stroke();
  }

  // keep track of the scroll modification for display updates
  trackScroll(event) {
    this.setState({
      scrollTop: event.target.scrollTop,
      scrollLeft: event.target.scrollLeft
    })
  }

  render() {
    const decimals = 100; //2 decimal places
    return (
      <div className="App">
        <div>
          <input type="file" id="file" style={{display: 'none'}} onChange={(event) => this.updateDisplayImage(event)}/>
          <label htmlFor="file" className="fancy-blue-button" accept="image/*">Select Image</label>
        </div>
        <div className="giant-image" onClick={event => this.updateDisplay(event)} onScroll={event => this.trackScroll(event)}><img src={this.state.display.src} alt=""/></div>
        <div>
          <button className="fancy-blue-button" onClick={() => this.startActive()}>{this.state.start.message}</button>
          <button className="fancy-blue-button" onClick={() => this.endActive()}>{this.state.end.message}</button>
        </div>
        
        <div className="resize-settings">
          <div>Physical Distance (ft): <input value={this.state.physicalDistance} onChange={event => this.updatePhysical(event)}/></div>
          <div>Desired Scale (Feet Per Inch): <input value={this.state.scale} onChange={event => this.updateScale(event)}/></div>
        </div>
        
        <div><button className="fancy-blue-button" onClick={() => this.resize()}>Resize</button></div>
        
        {this.state.download && <div>
          <p>Zoom Factor: {Math.round(this.state.zoomFactor * decimals)/decimals}</p>
          <p>Size on Paper: 
            {Math.round(this.state.resizedImage.width / this.pdfPoints * decimals)/decimals}" x 
            {Math.round(this.state.resizedImage.height / this.pdfPoints * decimals)/decimals}"</p>
        </div>}
        
        <div>
          <a href={this.state.resizedImage.src} download>
            <button className="fancy-blue-button" disabled={!this.state.download}>Download</button>
          </a>
        </div>
      </div>
    );
  }
  
}

export default App;
