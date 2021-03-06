var debug = 0.;
var perf = 0;

var currentState = null;
var initialState = 'Ground';
var inputBuffer = '';
var parameters = '';
var outputBuffer = new Array();
var formatArray = new Array();
var divs = new Array();
var dirtyLines = new Array();
var modifiedLines = new Array();
var term = null;
var formatString = '00';
var cursorY = 0;
var cursorX = 0;
var width = 80;
var height = 24;

var start = new Array();
var end = new Array();

var log = function(output){
    if (debug == 1) {
        console.log(output);
    }
};
	
function startTimer(message) {
	if (perf == 1) {
		start[message] = new Date();
	}	
}

function endTimer(message) {
	if (perf == 1) {
		end[message] = new Date();
		
		var difference = end[message].getTime() - start[message].getTime();
		
		if (difference > 10) {
			console.log(message + " took " + difference + " milliseconds");
		}
	}
}

function readCharCode() {
	var charCode = inputBuffer.charCodeAt(0);
	
	inputBuffer = inputBuffer.substr(1);
	
	return charCode;
}

function readChar() {
	var nextChar = inputBuffer.charAt(0);
	
	inputBuffer = inputBuffer.substr(1);
	
	return nextChar;
}

function clearLine(i) {
	if (modifiedLines[i]) {
		dirtyLines[i] = true;
		
		for (j = 0; j < width; j++) {
			outputBuffer[i][j] = "&nbsp;";
			formatArray[i][j] = '00';
		}
		
		modifiedLines[i] = false;
	}
}

function moveCursorToLocation(location) {
	if (location) {
		var list = location.split(';');
		
		while (list[0].charAt(0) == "0")
		{
			list[0] = list[0].substring(1, list[0].length);
		}
		
		while (list[1].charAt(0) == "0")
		{
			list[1] = list[1].substring(1, list[1].length);
		}
		
		var y = parseInt(list[0]);		
		var x = parseInt(list[1]);
		
		y--;
		x--;
				
		cursorY = y;
		cursorX = x;
	}

	if (location == '') {
		cursorY = 0;
		cursorX = 0;
	}
			
	log("Move cursor to location: " + cursorY + "," + cursorX);
}

function scrollY() {
	for (i = 0; i < (height - 1); i++) {
		outputBuffer[i] = outputBuffer[i + 1];
		formatArray[i] = formatArray[i + 1];
		dirtyLines[i] = true;
	}

	outputBuffer[height - 1] = new Array();
	formatArray[height - 1] = new Array();
	
	for (j = 0; j < width; j++) {
		outputBuffer[height - 1][j] = '&nbsp;'
		formatArray[height - 1][j] = '00';
	}
	
	modifiedLines[height - 1] = true;
	dirtyLines[height - 1] = true;
}

function VT100Parser() {
	this.acceptData = acceptData;
	
	term = document.getElementById('terminal');
	
	for (i=0; i < height; i++) {
		outputBuffer[i] = new Array();
		formatArray[i] = new Array();
		dirtyLines[i] = false;
		modifiedLines[i] = false;
		
		divs[i] = document.createElement('div');
		divs[i].className = "default";
		
		for (j=0; j < width; j++) {
			outputBuffer[i][j] = "&nbsp;";
			formatArray[i][j] = formatString;
			
			divs[i].innerHTML += outputBuffer[i][j];
		}
	
		term.appendChild(divs[i]);
	}
	
	currentState = initialState;
}

function unhandledEvent(event) {
	if (cursorX >= width) {
		cursorX = 0;
		
		if (this.cursorY < this.height - 1) {
			this.cursorY++;
		} else {
			scrollY();
		}
	}
	
	if (event == " ") {
		event = "&nbsp;";
	} else if (event == "&") {
		event = "&amp;";
	} else if (event == "<") {
		event = "&lt;";
	} else if (event == ">") {
		event = "&gt;";
	} else if (event == "+") {
		event = "&#43;";
	}
	
	outputBuffer[cursorY][cursorX] = event;
	formatArray[cursorY][cursorX] = formatString;
	dirtyLines[cursorY] = true;
	modifiedLines[cursorY] = true;
	
	cursorX++;

	return initialState; 	
}

function acceptData(data) {
	startTimer("acceptData()");
	inputBuffer += data;
		
	log("Data: " + data);

	startTimer("data");
	while (inputBuffer.length > 0) {
		if (currentState == 'Ground') {
			var event = readCharCode();
		} else {
			var event = readChar();
		}

		if (currentState == 'xterm param') {
			while (!event.match(String.fromCharCode(7))) {
				parameters += event;
				event = readChar();
			}
			
			event = event.charCodeAt(0);
		}

		var parserFunction = parserFunctions[currentState][event];
		
		if (!parserFunction) {
			if (currentState == 'Ground') {
				var event = String.fromCharCode(event);
			}
			else 
				if (currentState == 'CSI param') {
					if (event.charCodeAt(0) == 8) {
						log("Backspace removes previous parameter character");
						
						parameters = parameters.substr(0, parameters.length - 1);
						continue;		
					} else if (event.charCodeAt(0) == 11) {
						log("Vertical Tabulation sends a line feed");
						
						cursorY++;
						continue;
					} else if (event.charCodeAt(0) == 13) {
						log("Carriage return sets the x cursor to 0");
							
						cursorX = 0;
						continue;
					}
					
					parameters += event;					
					continue;
				}
			
			parserFunction = unhandledEvent;
		}
		
		var nextState = parserFunction.call(this, event);

		if (!nextState) 
			nextState = currentState;
		if (!parserFunctions[nextState]) 
			log("Undefined");
			
		currentState = nextState;
	}
	endTimer("data");
	
	startTimer("display");
	// Redisplay the screen
	for (i = 0; i < height; i++) {
		if (dirtyLines[i] == false) {
			continue;
		}
			
		dirtyLines[i] = false;
		
		divs[i].innerHTML = '';
		
		var j = 0;
		while (j < width) {
			var format = formatArray[i][j];

			startTimer("format");
			var start = j;
			
			while (format == formatArray[i][j]) {
				j++;
				
				if (j == width) {
					break;
				}
			}
			var parameterList = format.split(';');
			var newSpan = document.createElement('span');
			
			startTimer("item");
			for (item = 0; item < parameterList.length; item++) {
				switch (parameterList[item]) {
					case '01':
						log("Set graphics mode: Bright on");
						
						newSpan.className += "bright";
						break;
					case '7':
						log("Set graphics mode: Reverse video on");
						
						newSpan.className += "reverse ";
						break;
					case '32':
						log("Set graphics mode: Foreground to green")
						
						newSpan.className += "green ";
						break;
					case '34':
						log("Set graphics mode: Foreground to blue");
						
						newSpan.className += "blue ";
						break;
					case '39':
						log("Set graphics mode: Foreground to default");
						
						newSpan.className += "default ";
						break;
					case '49':
						log("Set graphics mode: Background to default");
						
						newSpan.className += "default ";
						break;
					default:
						break;
				}
				
				var finalString = '';
				
				for (z = start; z < j; z++) {
					finalString += outputBuffer[i][z];
				}
				
				newSpan.innerHTML = finalString;
				
				divs[i].appendChild(newSpan);
			}
			endTimer("item");
			endTimer("format");
		}
	}
	endTimer("display");
	endTimer("acceptData()");
}

var	parserFunctions = {
	Ground: {
		8: function(event) {
			log("Backspace");
			
			if (cursorX > 0) {
				cursorX--;
			} else {
				if (cursorY > 0) {
					cursorY--;
				}
				
				cursorX = width--;
			}
		},
		10: function(event) {
			log("Line feed");
			
			if (cursorY < height - 1) {
				cursorY++;
			} else {
				scrollY();
			}
		},
		13: function(event) {
			log("Carriage return");
			
			cursorX = 0;
		},
		27: function(event) {
			log("ESC control code received");
			
			return 'Escape';
		},
	},
	Escape: {
		'D': function(event) {
			log("Scroll window down one line");
			
			cursorY++;
			
			return 'Ground';
		},
		'E': function(event) {
			log("Move to next line");
			
			cursorY++;
			cursorX = 0;
			
			return 'Ground';
		},
		'M': function(event) {
			log("Scroll window up one line");
			
			cursorY--;
			
			return 'Ground';
		},
		'[': function(event) {
			log("CSI control code received");
			
			return 'CSI param';
		},
		']': function(event) {
			log("XTerm control code received");
			
			return 'xterm intermediate';
		},
		'(': function(event) {
			log("CSI command code received");
			
			return 'CSI command';
		},
		'=': function(event) {
			log("Numeric keys act as arrow keys: Not implemented");
			
			return 'Ground';
		},
		'#': function(event) {
			log("Screen command code received");
			
			return 'Screen param';
		}
	},
	'xterm intermediate' : {
		0: function(event) {
			log("Set icon name and window title: Not implemented");
			
			return 'xterm intermediate';
		},
		';': function(event) {
			log("XTerm intermediate end code received");
			
			return 'xterm param';
		}
	},
	'xterm param': {
		7: function(event) {
			log("XTerm BEL received");

			parameters = '';
			
			return 'Ground';
		}
	},
	'CSI param': {
		'?': function(event) {
			log("Cursor code received");
			
			return 'CSI param';
		},
		A: function(event) {
			var parameter = parseInt(parameters);
			
			if (parameter == 0) {
				parameter = 1;
			}
			
			log("Move cursor up " + parameter + " lines");
			
			cursorY -= parameter;
			if (cursorY < 0) {
				cursorY = 0;
			}
			
			log("New cursor location: " + cursorY + "," + cursorX);
			
			parameters = '';
			
			return 'Ground';
		},
		B: function(event) {
			var parameter = parseInt(parameters);
			
			if (parameter == 0) {
				parameter = 1;
			}
			
			log("Move cursor down " + parameter + " lines");
			
			cursorY += parameter;
			if (cursorY > height) {
				cursorY = (height - 1);
			}
			
			log("New cursor location: " + cursorY + "," + cursorX);
			
			parameters = '';
			
			return 'Ground';
		},
		c: function(event) {
			log("Identify what terminal type we are");
			
			lunaService("luna://com.palm.terrae/write", "{\"id\": " + id + ", \"data\": \"" + String.fromCharCode(27) + "?64c" + "\" }");
			
			parameters = '';
			
			return 'Ground';
		},
		C: function(event) {
			var parameter = parseInt(parameters);
			
			if (parameter == 0 || !parameter) {
				parameter = 1;
			}
			
			log("Move cursor right " + parameter + " columns");
			
			cursorX += parameter;
			if (cursorX > width) {
				cursorX = (width - 1);
			}
			
			log ("New cursor location: " + cursorY + "," + cursorX);
			
			parameters = '';
			
			return 'Ground';
		},
		D: function(event) {
			var parameter = parseInt(parameters);
			
			if (parameter == 0) {
				parameter = 1;
			}
			
			log("Move cursor left " + parameter + " columns");
			
			cursorX -= parameter;			
			if (cursorX < 0) {
				cursorX = 0;
			}
			
			log ("New cursor location: " + cursorY + "," + cursorX);
			
			parameters = '';
			
			return 'Ground';
		},
		f: function(event) {
			moveCursorToLocation(parameters);
			
			parameters = '';
			
			return 'Ground';
		},
		h: function(event) {
			log("Cursor mode: " + parameters);
			
			switch (parameters) {
				case '1':
					log("Arrow key movement mode: Not implemented");
					
					break;
				case '3':
					log("Set number of columns to 132");
					
					width = 132;
					
					for (i = 0; i < height; i++) {
						clearLine(i);
					}

					cursorY = 0;					
					cursorX = 0;
					
					break;
				case '1049':
					log("Altscreen mode: Ignored");
					
					break;
				default:
					break;
			}

			parameters = '';
			
			return 'Ground';
		},
		H: function(event) {
			moveCursorToLocation(parameters);
			
			parameters = '';
			
			return 'Ground';
		},
		J: function(event) {
			switch(parameters) {
				case '0':
					log("Clear from cursor to end of screen");
					
					for (i = cursorY; i < height; i++) {
						clearLine(i);
					}
					
					for (j = cursorX; j <= width; j++) {
						outputBuffer[cursorY][j] = '&nbsp;';
					}
					
					dirtyLines[cursorY] = true;
					
					break;
				case '1':
					log("Clear from beginning of screen to cursor");
				
					for (i = 0; i < cursorY; i++) {
						clearLine(i);
					}
					
					for (j = 0; j <= cursorX; j++) {
						outputBuffer[cursorY][j] = '&nbsp;';
					}
					
					dirtyLines[cursorY] = true;
					
					break;
				case '2':
					log("Clear entire screen");
					
					for (i = 0; i < height; i++) {
						clearLine(i)
					}
					break;
				default:
					break;
			}
			
			parameters = '';
			
			return 'Ground';
		},
		K: function(event) {
			if (!parameters) {
				parameters = '0';
			}
			
			switch(parameters) {
				case '0':
					log("Clear line " + cursorY + " from cursor " + cursorX + " right");
					
					for (i = cursorX; i < width; i++) {
						outputBuffer[cursorY][i] = '&nbsp;';
					}
					
					dirtyLines[cursorY] = true;
					
					break;
				case '1':
					log("Clear line " + cursorY + " from cursor " + cursorX + " left");
					
					for (i = cursorX; i > 0; i--) {
						outputBuffer[cursorY][i] = '&nbsp;';
					}
					
					dirtyLines[cursorY] = true;
					
					break;
				case '2':
					log("Clear entire line: " + cursorY);
					
					clearLine(cursorY);
					break;
				default:
					break;
			}
			
			parameters = '';
			
			return 'Ground';
		},
		l: function(event) {
			switch (parameters) {
				case '3':
					log("Set the number of columns to 80");
					
					width = 80;
					
					for (i = 0; i < height; i++) {
						clearLine(i);
					}

					cursorY = 0;					
					cursorX = 0;
					
					break;
				default:
					break;
			}
			
			parameters = '';
			
			return 'Ground';
		},
		m: function(event) {
			log("Display mode: " + parameters);

			if (parameters == '') {
				formatString = '00';
				
				return 'Ground';
			}

			formatString = parameters;
			
			parameters = '';
			
			return 'Ground';
		},
		r: function(event) {
			log("Set bounds of screen page: Not implemented");
			
			parameters = '';
			
			return 'Ground';
		}
	},
	'CSI command': {
		B: function(event) {
			log("Command set US G0 char set: Ignoring");
			
			return 'Ground';
		}
	},
	'Screen param': {
		'8': function(event) {
			log("Screen alignment display");
			
			for (i = 0; i < height; i++) {
				for (j = 0; j < width; j++) {
					dirtyLines[i] = true;
					modifiedLines[i] = true;
					outputBuffer[i][j] = 'E';
				}
			}
			
			return 'Ground';
		}
	}
}
