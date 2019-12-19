let quizBlock = document.getElementById("quiz");
let signInBlock = document.getElementById("sign-in");
let btnBlock = document.getElementById("quiz-buttons");
let scoreBlock = document.getElementById("quiz-score");
let infoBlock = document.getElementById("quiz-info");
let countBlock = document.getElementById("countdown");
let nameEntry = document.getElementById("text-box");
let chatBlock = document.getElementById("chat");
let chatBtn = document.getElementById("message");
let removeName = document.getElementById("id-box");

let canGoNext = true;
let green = "rgb(99, 201, 116)";

// Allows the user to use the enter key to join trivia
nameEntry.addEventListener("keyup", function(event) { 
    if (event.keyCode === 13) {
        document.getElementById("join-btn").click();
    }
});

let socket = null;

// Adds a new user to the trivia 
function joinTrivia() {
    let name = nameEntry.value.trim();

    if (name.length === 0) {
        alert("Username cannot be blank");
    } else {
        if(socket == null){
            socket = io();
            socket.on("newUser", addToGame);
            socket.on("updateScores", updateScores);
            socket.on("nextQuestion", nextQuestion);
            socket.on("awaitNewQuestion", awaitQuestion);
            socket.on("newRound", newRound);
            socket.on("showWinner", showWinner);
            socket.on("updateStatus", updateStatus);

            // Admin Functions
            socket.on("restart", restartGame);
            socket.on("removePlayer", removePlayer);

            // Stats 
            socket.on("showStats", populateStats);

            // Messages
            socket.on("newMessage", newMessage);
            socket.on("init", initMessages);
            
            socket.emit("register", name);
        }

        // Enables chat, admin, and admin page
        document.getElementById("menu-btn").style.display = "block";
        document.getElementById("chat-head").style.display = "block";
        document.getElementById("chat-button").style.display = "block";
    }
}

// User is added to game, display the proper trivia page
function addToGame(name) { 
    clearSignIn();

    let newLI = document.createElement("li");
	let text = document.createTextNode(name + " joined the chat");
	newLI.appendChild(text);
	chatBlock.appendChild(newLI);

}

// Deals with sending messages to the chat
function sendMessage(){
    let msg = chatBtn.value;

    if(msg.trim().length > 0){
		socket.emit("newMessage", msg);
    }
    chatBtn.value = ""; // clear the text in the chat block
}

// Initializes the messages when a user joins the game
function initMessages(data){
    chatBlock.scrollTop = chatBlock.scrollHeight;
	let msg = JSON.parse(data).messages;
	msg.forEach(elem => {
		newMessage(elem);
	});
}

// A new message is displayed
function newMessage(message){
	let newLI = document.createElement("li");
	let text = document.createTextNode(message);
	newLI.appendChild(text);
    chatBlock.appendChild(newLI);
    chatBlock.scrollTop = chatBlock.scrollHeight;
}

// Sets up a new round on the client side
function newRound(ready) { 
    
    if (ready) {
        socket.emit("nextQuestion", nextQuestion);
    }

}

// Displays the scores of all users
function updateScores(scores) {
    let score = JSON.parse(scores);
    scoreBlock.innerHTML = "";

	score.forEach(elem => {
        let str = elem.name + ": " + elem.points;
        let score = document.createElement("div");
        let text = document.createTextNode(str);

        score.appendChild(text);
    
        scoreBlock.appendChild(score);
    });
    
}

// Updates the status if a client has submitted their answer
function updateStatus(scores) { 
    let score = JSON.parse(scores);
    let leaderboard = scoreBlock.children;
    let count = 0;

    score.forEach(elem => {

        if (elem.answered) {
            leaderboard[count].style.color = green;
        }

        count ++;
    });
}

// Function that will continue the quiz if all users have entered their answers
function awaitQuestion(done) { 
    if (done) {
        socket.emit("nextQuestion", nextQuestion);
    }
}

// Adds new question 
function nextQuestion(data) {

    // Clear data from previous test, if any
    clearPrevTest();

    // Update the scores after each question 
    socket.emit("updateScores", updateScores);

    let quizData = JSON.parse(data);
    let questionData = quizData.quiz;
    let round = quizData.currentRound;
    let question = quizData.currentQuestion;

    // End of round
    if (question == 6) {

        // Disables the user from changing questions in the admin page
        canGoNext = false;

        // Clear the quiz
        clearQuiz();
        
        // Title Page for end screen
        let title = document.createElement("h4");
        title.innerHTML = "End of Round " + round;
        infoBlock.appendChild(title);

        // Display the winner(s) of the round
        socket.emit("showWinner", showWinner);
    
        // Wait 3 seconds between rounds
        var time = 3;
        var downloadTimer = setInterval( function() {
            countBlock.innerHTML = "A new round will begin in " + time + " seconds";
            time -= 1;

            if(time < 0){
                clearInterval(downloadTimer);
                countBlock.innerHTML = "Preparing for a new round...";

                // Begin next round 
                canGoNext = true;
                socket.emit("newRound", newRound);

            }
        }, 1000);

    } else { // Round is still going on, display new question

        //Display the round and question numbers
        let title = document.createElement("h4");
        title.innerHTML = "Round " + round + " - Question " + question;
        infoBlock.appendChild(title);

        makeQuestion(questionData);
    }

}

// Displays the current question to the user
function makeQuestion(questionObject) {

    // Container to hold all the data for each question
    let questionDiv = document.createElement("div");
    questionDiv.class = "question-div";

    // Question number header
    let questionHead = document.createElement("h2");
    questionHead.className = "question-header";
    
    // Question info header
    let questionInfo = document.createElement("h5");
    questionInfo.className = "question-info";
    questionInfo.innerHTML = "Category: " + questionObject["category"] + " | Difficulty: " + questionObject["difficulty"];

    // Div that contains the question text
    let questionText = document.createElement("div");
    questionText.className = "question-text";
    questionText.innerHTML = questionObject["question"];

    // Div that contains the answer list
    let answerList = document.createElement("div");
    answerList.className = "answer-list";

    // Index for correct answer is randomized
    let answerIndex = Math.floor(Math.random() * (questionObject["incorrect_answers"].length + 1)); 

    // For every single answer (incorrect answers + 1 correct answer)
    for (let i = 0; i < questionObject["incorrect_answers"].length + 1; i++) { 

        let label = document.createElement("label");
        label.className = "not-selected";
        let input = document.createElement("input");
        input.type = "radio";
        input.name = "group";

        let text = ""; 

        if (i == answerIndex) { // Answer index
            text = questionObject["correct_answer"];
            label.className = "correct";

        } else if (i > answerIndex) { // Answer already added, indexing changed by 1
            text = questionObject["incorrect_answers"][i-1];
            label.className = "not-selected";

        } else { // Answer not yet added, can follow indexing of the for loop
            text = questionObject["incorrect_answers"][i];
            label.className = "not-selected";

        }

        // Uses a DOMParser to convert the text into html then retrieve the decoded text content for special characters
        let parser = new DOMParser;
        let dom = parser.parseFromString(text, 'text/html');
        let decodedText = dom.body.textContent;
        
        input.value = decodedText;

        // Creates a text node and populates it with the text of the answer
        let textNode = document.createTextNode(decodedText);

        // Adds elements to the question label
        label.appendChild(input);
        label.appendChild(textNode);
        label.appendChild(document.createElement("br"));

        // Add the current answer to the answerList div 
        answerList.append(label);

        // Adds the button
        addNextBtn();
        
    }

    // Appends all elements required for a question to the questionDiv
    questionDiv.appendChild(questionHead);
    questionDiv.appendChild(questionInfo);
    questionDiv.appendChild(questionText);
    questionDiv.appendChild(answerList);

    // Adds the current question to the page
    quizBlock.append(questionDiv);

}

// Function that adds the next page button
function addNextBtn() { 
    btnBlock.innerHTML = `<br><input type="submit" id="next-btn" value="Next">`;

	// Sets the functionality of the buttons
	nextBtn = document.getElementById('next-btn');
    nextBtn.onclick = function() { checkAnswer() };
    
}

// Checks if the user got the correct answer. Adjusts score accordingly
function checkAnswer() {
    let valid = false;

    // Array containing the answers for each question
    let answers = document.getElementsByName("group"); 
    
    for (let i = 0; i < answers.length; i ++) {

        if (answers[i].checked) {
            if (answers[i].parentNode.className === "correct") {
                // Correct answer, add 100 points
                socket.emit("addPoints", 100);
            } else {
                // Incorrect answer, subtract 100 points
                socket.emit("addPoints", -100);
            }

            valid = true;
        }

    }

    if (valid) {
        disableButtons();
        socket.emit("awaitNewQuestion", awaitQuestion);
    } else {
        alert("You must answer the question!");
    }

}

// Displays the scores of the round winner(s)
function showWinner(scores) {
   
    let winnerHead = document.createElement("h4");
    winnerHead.innerHTML = "Round Winner(s)"

    scoreBlock.appendChild(winnerHead);

    // Displays to the client
    scores.forEach(elem =>{
        let str = elem.name + ": " + elem.points + " points";
        let score = document.createElement("div");
        let text = document.createTextNode(str);
        score.appendChild(text);
    
        scoreBlock.appendChild(score);
    });
    
}

// Function that restarts the game 
function restartGame() {
    if (canGoNext) {  // Only available if during a round
        socket.emit("restartGame", restartGame); 
    }
}

// Function that forces clients to move onto the next question
function forceNext() {
    if(canGoNext) { // Only available if during a round
        socket.emit("nextQuestion", nextQuestion);
    }
}

// Function that removes a player from the game
function removePlayer() {
    let name = removeName.value.trim();
    socket.emit("removePlayer", name);
}

// Returns the to home page
function mainPage() {
    document.getElementById("main").style.display = "block";
    document.getElementById("menu-btn").style.display = "block";
    document.getElementById("admin").style.display = "none";
    document.getElementById("stats-bar").style.display = "none";
    document.getElementById("stats").style.display = "none";
}

// Goes to the admin page
function adminPage() {
    document.getElementById("main").style.display = "none";
    document.getElementById("menu-btn").style.display = "none";
    document.getElementById("admin").style.display = "block";
}

// Goes to the player stats page
function statPage() {
    document.getElementById("main").style.display = "none";
    document.getElementById("menu-btn").style.display = "none";
    document.getElementById("stats-bar").style.display = "block";
    document.getElementById("stats").style.display = "block";
    socket.emit("showStats", populateStats);
}

// Populate the table of the stats page
function populateStats(data) {

    document.getElementById("stats").innerHTML = "";

    // Construct the table and its header
    var table = document.createElement("TABLE");
    table.id = "table";
    table.border = 1;
    document.getElementById("stats").appendChild(table);

    tb = document.getElementById("table");

    addRow(tb, "Username", "Average Score", "Games Played", "Wins");

    // Add player data
    if (!(Object.entries(data).length === 0 && data.constructor === Object)) {
        for (var elem in data) {
            if (Object.prototype.hasOwnProperty.call(data, elem)) {
                addRow(tb, elem, (data[elem].score / data[elem].gamesPlayed).toFixed(2), data[elem].gamesPlayed, data[elem].wins);

        }};
    }

    document.getElementById("stats").appendChild(table);

}

// Helper function to add a row to the stats table
function addRow(tb, x1, x2, x3, x4) {
    var tr = document.createElement("tr");

    addCell(tr, x1);
    addCell(tr, x2);
    addCell(tr, x3);
    addCell(tr, x4);

    tb.appendChild(tr);

}

// Helper function to add a cell to the stats table
function addCell(tr, x) {
    var td = document.createElement("td");

    td.innerHTML = x;

    tr.appendChild(td);
}

// Function that disables the radio and the "next" button
function disableButtons() {
    let buttons = document.getElementsByName("group"); 
    
    for (let i = 0; i < buttons.length; i ++) {
        buttons[i].disabled = true;
    }

    // Disables the next button 
	nextBtn.disabled = true;

}

// Function that clears the sign in screen
function clearSignIn() {
    signInBlock.innerHTML = "";
}

// Function that completely clears the HTML from previous tests
function clearPrevTest() {

	// Clear questions
    quizBlock.innerHTML = "";
    
    // Clear question info header
    infoBlock.innerHTML = "";

    // Clears the countdown timer
    countBlock.innerHTML = "";

}

// Function that clears all HTML associated with the quiz
function clearQuiz() {

    // Clear questions
    quizBlock.innerHTML = "";

    // Clear next question button
    btnBlock.innerHTML = "";

    // Clear question info header
    infoBlock.innerHTML = "";

    // Clears the countdown timer
    countBlock.innerHTML = "";

}