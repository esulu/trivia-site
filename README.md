### Trivia Game

Online trivia game made using web sockets. 

## How to play 

- Enter a username and select the "Join Trivia" button to join a trivia game
- Either a new quiz will start, or it will make the user join an on-going quiz
- A question will be prompted, and the user will have options to select an answer
- An answer is only submitted if the user selects the "Next" button
- Each round of trivia consists of five questions, and scores are reset at the end of each round
- There is a 3 second grace period at the end of a round that displays the round winner(s)
- The round will proceed to the next question only if all active users have submitted a response
    - If a user without a response leaves at this point, and all other users have submitted a response, the quiz will proceed to the next question
- A display of all active players and their respective scores will be displayed above the question
    - The text of players with completed answers will be green if there are multiple players

## Extras 

1. Administrator Page
    - The person viewing the administrator UI is able to perform the following commands:
        - Restart the game; All leaderboard stats are cleared, round and question numbers are reset to one
        - Advance to the next question; Forces all players to go to the next question, or a new round if there are no questions left
        - Remove player: Given a player username, the admin can remove the player from the game
    - The administrator UI can be activated at any time during the game
    - The remove player function will work at any time during the game
    - The restart game and next question functions only work in the midst of a round, and not when in between rounds

2. Statistics Page
    - During any point in the quiz, the user can view the statistics of all players that took the quiz
    - Statistics display each player's username, average score, number of games played, and number of wins
    - The statistics page is updated at the end of every round
    - The statistics are stored into a file called "data.json" that keeps track of all player data
        - When the server is restarted, all data is remembered 

3. Chat Implementation
    - During any point of the quiz, all users can read and send messages to the chat
    - Chat displays whenever a user connects
    - Chat automatically scrolls to the bottom whenever a new message is sent and the chat display is full
    - Chat contents are updated immediately for all users whenever a new message is sent
    - Each message displays the name of the player who sent that message