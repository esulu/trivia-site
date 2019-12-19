var request = require('request');
var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var fs = require('fs');

// File requests 
app.get('/', function(req, res) {
    res.sendFile(__dirname + '/index.html');
});

app.get('/style.css', function(req, res) {
    res.sendFile(__dirname + '/style.css');
});

app.get('/main.js', function(req, res){
    res.sendFile(__dirname + '/main.js');
});

app.use(function(req, res) {
    send404(res); // send 404 for invalid requests 
});

//Helper function for sending 404 message
function send404(response) {
	response.writeHead(404, { 'Content-Type': 'text/plain' });
	response.write('Error 404: Resource not found.');
	response.end();
}

let questions = [];
let leaderboard = [];
let messageData = [];
let jsonData = getStatData();
let users= 0;
let usersActive = 0;
let roundNum = 1;
let questionNum = 1;
let ready = 0;

/**
 * Makes the initial request when the server first loads
 */ 
request('https://opentdb.com/api.php?amount=5', function (err, res, body) {
    
    // Unsuccessful request
    if (err) {
        send404(res);
    } 
    
    let data = JSON.parse(body);

    if (data["response_code"] !== 0) {
        send404(res);
    }

    // Stores the data on the server
    questions = data["results"];

});

/**
 * Every time the function is called it sends a request to the Open Trivia DB for a new set of 5 questions
 */
function makeRequest(callback) {
    request('https://opentdb.com/api.php?amount=5', function (err, res, body) {
        
        // Unsuccessful request
        if (err) {
            send404(res);
        } 
        
        let data = JSON.parse(body);

        if (data["response_code"] !== 0) {
            send404(res);
        }

        // Stores the data on the server
        questions = data["results"];

        callback();

    });
}

/**
 * Updates the data stored for the stats for each player
 */
function updatePlayerData() {
     // JSON data format for each player: { name : {score, gamesPlayed, wins} }

    var winnerList = [];

    // adds the stats of the highest scoring player(s) to the winnerNames array
    leaderboard.forEach(elem => {
        if (winnerList.length === 0 || elem.points > winnerList[0].points) {
            winnerList = [{name: elem.name, points: elem.points}];
        } else if (elem.points === winnerList[0].points) { 
            winnerList.push({name: elem.name, points: elem.points});
        }
    });

    let winnerNames = [];

    // Getting just an array of the names of the highest achieving players
    winnerList.forEach(elem => {
        winnerNames.push(elem.name);
    });

    let sockets = io.sockets.sockets;

    // Adds data for each player
    for (var i in sockets) {
        if (jsonData.hasOwnProperty(sockets[i].username)) {
            // Player already exists in the database
            jsonData[sockets[i].username].score += sockets[i].points;
            jsonData[sockets[i].username].gamesPlayed ++;
        } else {
            // Player does not exist, add them
            let name = sockets[i].username;
            let playerObject = { "score" : sockets[i].points, "gamesPlayed" : 1, "wins" : 0};
            toAdd = {};
            toAdd[name] = playerObject;

            Object.assign(jsonData, toAdd);
        }

        // Add to the win counter 
        if (winnerNames.includes(sockets[i].username)) {
            jsonData[sockets[i].username].wins ++;
        }

        // Write new data to the JSON file
        data = JSON.stringify(jsonData);
        fs.writeFileSync("data.json", data);

    }

}

/**
 * Function that converts the JSON data into an object 
 */
function getStatData() {
    let data = fs.readFileSync('data.json');
    return JSON.parse(data);
}

/**
 * User connection
 */
io.on('connection', function(socket) {
    users++;

    socket.on('disconnect', function() { 
        
        // Checks if the user that left was active in the trivia or not 
        if (usersActive === users) {
            usersActive --;
        }

        users --;
        
        if (usersActive === 0) { // Data is reset when all usersActive leave the game
            leaderboard = [];
            roundNum = 1;
            questionNum = 1;

            // Request different questions for the next game
            makeRequest( function() { } );

        } else { // Remove all data associated with that user 

            // Remove the user from the leaderboard, also check if all usersActive have submitted their answers
            let sockets = io.sockets.sockets;
            let result = true;
            let count = 0;

            for (var i in sockets) {

                // user hasn't answered
                if (!sockets[i].answered) {
                    result = false;
                }
                
                // Determine where the user that left's info was and delete it 
                if (sockets[i].username != leaderboard[count].name) {
                    leaderboard.splice(count, 1);  
                    break;
                } else if (count === usersActive-1) {
                    leaderboard.splice(count+1, 1);  
                    break;
                }      

                count ++;
            }

            // If all usersActive were waiting on the user that left, proceed 
            if (result) {

                // Resets the values 
                for(var i in sockets) {
                    sockets[i].answered = false;

                    // Resets the values stored on the server
                    let obj = leaderboard.find(o => o.name === sockets[i].username);
                    if (typeof obj != "undefined") { // User didn't leave
                        obj.answered = false;
                    }

                }

                // All answers are in, proceed to the next question by emitting info to one socket
                for(var i in sockets) {
                    sockets[i].emit('awaitNewQuestion', result);
                    break;
                }

            }
        }
    });

    /**
     * Client joins the trivia
     * - client data is initialized
     * - server sends chat data to the client
     * - server sends the question data to the client
     * - new user's data is sent to the leaderboard 
     * - new user's name is sent to everyone
     */
    socket.on('register', function(name) {
        usersActive ++;
        socket.username = name;
        socket.points = 0;
        socket.answered = false;
        socket.emit('init', JSON.stringify({messages: messageData}));
        leaderboard.push({"name" : socket.username, "points" : socket.points, "answered" : socket.answered});
        io.emit('updateScores', JSON.stringify(leaderboard));
        socket.emit('nextQuestion', JSON.stringify({quiz : questions[questionNum-1], currentRound : roundNum, currentQuestion : questionNum}));
        io.emit("newUser", name);
    });

    /**
     * New question is requested
     * - Requests a new question from Open Trivia DB
     * - Sends the question data back to the clients  
     * - Note: if the question number would exceed 5, make a new request for questions
     */
    socket.on('nextQuestion', function() {
       questionNum ++;

       if (questionNum > 5) {
           
           // No more questions, send last one with information that this is the end of the round
           io.emit('nextQuestion', JSON.stringify({quiz : questions[0], currentRound : roundNum, currentQuestion : questionNum}));

           // Get a new batch of questions for the next round
           makeRequest( function() { } );

           // Updates the player stats
           updatePlayerData();

       } else { 

           // Send data to all clients 
           io.emit('nextQuestion', JSON.stringify({quiz : questions[questionNum-1], currentRound : roundNum, currentQuestion : questionNum}));

       }

    });

    /**
     * Returns a true or false value depending on whether all usersActive have submitted their results
     * - Sends the status of the current socket to the other sockets
     */
    socket.on('awaitNewQuestion', function() { 
        let result = true;
        socket.answered = true;

        // Updates the answered question on the server
        let obj = leaderboard.find(o => o.name === socket.username);
        if (typeof obj != "undefined") { // User didn't leave
            obj.answered = true;
        }


        // Checks if all usersActive made their answers
        var sockets = io.sockets.sockets;
        for(var i in sockets) {
            var s = sockets[i];
            if (!s.answered) {
                result = false;
            }
        }

        // Not all users have completed their entries
        if (!result) { 

            // Update the leaderboard every time a client answered a question
            io.emit('updateStatus', JSON.stringify(leaderboard));
        
        } else { // All answers are in

             // Resets the values 
            for(var i in sockets) {
                sockets[i].answered = false;

                // Resets the values in the leaderboard
                let obj = leaderboard.find(o => o.name === sockets[i].username);
                if (typeof obj != "undefined") { // User didn't leave
                    obj.answered = false;
                }
            }

        }
        
        // Send the result to the client 
        socket.emit('awaitNewQuestion', result);

    });

    /**
     * Sets up game for a new round 
     * - Resets the points of all users from the leaderboard
     */
    socket.on('newRound', function() {
        let result = false;
        ready ++;

        if (ready === usersActive) {
            ready = 0;
            result = true;

            // Every player's score is set to zero
            let sockets = io.sockets.sockets;
            for(var i in sockets) {
                sockets[i].points = 0;

                // Resets the score in the leaderboard
                let obj = leaderboard.find(o => o.name === sockets[i].username);
                if (typeof obj != "undefined") { // User didn't leave
                    obj.points = 0;
                }
            }        

            // Resets the question number and increases the round number
            roundNum ++;
            questionNum = 0;

        } 
        
        socket.emit('newRound', result);
    });

    /**
     * A question is answered
     * - Add the points that were gained for the answer
     */
    socket.on('addPoints', function(points) {
        socket.points += points;

        // Updates the points stored on the server
        let obj = leaderboard.find(o => o.name === socket.username);
        if (typeof obj != "undefined") { // User didn't leave
            obj.points = socket.points;
        }

    });

    /**
     * Sends leaderboard data to be processed by the client
     */
    socket.on('updateScores', function() {
        socket.emit('updateScores', JSON.stringify(leaderboard));
    });

    /**
     * Sends leaderboard data to be processed by the client for the winner display
     */
    socket.on('showWinner', function() {

        var topScores = [];

        // Adds the name and points of the highest scoring player(s) to the topScores array
        leaderboard.forEach(elem => {
            if (topScores.length === 0 || elem.points > topScores[0].points) {
                topScores = [{name: elem.name, points: elem.points}];
            } else if (elem.points === topScores[0].points) { 
                topScores.push({name: elem.name, points: elem.points});
    
            }
        });

        socket.emit('showWinner', topScores);
    });

    /** 
     * Restarts the game
     * - Resets the round
     * - Resets the question 
     * - Resets scores and leaderboard info
     * - Gets a new batch of questions
     * - Starts a new round
     */
    socket.on('restartGame', function() {

        // Gets a new batch of questions
        makeRequest( function() {
            let sockets = io.sockets.sockets;
            for(var i in sockets) {
                sockets[i].points = 0;
                sockets[i].answered = false;
    
                // Resets the values in the leaderboard
                let obj = leaderboard.find(o => o.name === sockets[i].username);
                if (typeof obj != "undefined") { // User didn't leave
                    obj.points = 0;
                    obj.answered = false;
                }
    
            }        
    
            // Resets the question number and round number
            roundNum = 1;
            questionNum = 0;
    
            // Resets the leaderboard displays
            io.emit('updateScores', JSON.stringify(leaderboard));
            
             // Proceed to the next question by emitting info to one socket
             for(var i in sockets) {
                sockets[i].emit('awaitNewQuestion', true);
                break;
            }
    
        })
        
    });

    /**
     * Removes a player from the game 
     */
    socket.on("removePlayer", function(name) {
        
        let sockets = io.sockets.sockets;
        for(var i in sockets) {

            if (sockets[i].username === name) {
                if (io.sockets.connected[i]) {
                    io.sockets.connected[i].disconnect();
                }
                break;
            }

        }  

    });
    
    /**
     * Sends stats page information for display on the client side
     */
    socket.on('showStats', function() {
        socket.emit('showStats', jsonData);
    });

    /**
     * Chat functionality 
     */
    socket.on("newMessage", message => {
		message = socket.username + ": " + message
		messageData.push(message);
		io.emit("newMessage", message);
	});

});

app.listen(process.env.PORT || 3000);

