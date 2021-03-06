const { createConnection } = require('mysql2');
const player = require('./player');
var clock = require('date-events')()
module.exports = {
	name: "game",
    description: "Game commands. Start, end, respawnTime(minutes), newTargetTime(minutes)",

	execute(message, args) 
    {
        let commandType = "";

        if(args[0] === undefined)
        {
            commandType = "get"
        }
        else
        {
            commandType = args[0].toLowerCase();
        }

        global.con.query('SELECT * FROM `players`', function(err, results, fields) {
            if(err)
            {
                message.channel.send("SQL failed.");
                return;
            }

            let players = results;

            global.con.query('SELECT * FROM `game`', function(err1, results1, fields1) {
                if(err1)
                {
                    message.channel.send("SQL failed.");
                    return;
                }

                let game = results1[0];
                // bool conversion
                if(game.running === 1) game.running = true
                else game.running = false

                if(commandType == "get")
                {
                    const playerCommand = message.client.commands.get("player");
                    player.getPlayers(message);
                    return;
                }

                if(commandType == "start")
                {
                    if (global.adminIDs.includes(message.author.id) == false)
                    {
                        message.channel.send("You can't do this.")
                        return;
                    }
                    StartGame(message, game, players);
                }

                if(commandType == "end")
                {
                    if (global.adminIDs.includes(message.author.id) == false)
                    {
                        message.channel.send("You can't do this.")
                        return;
                    }
                    EndGame(message, game, players);
                }

                if(commandType == "respawntime")
                {
                    if (global.adminIDs.includes(message.author.id) == false)
                    {
                        message.channel.send("You can't do this.")
                        return;
                    }
                    if(args[1] === undefined) return;
                    let respawnTime = parseFloat(args[1]);
                    respawnTime = respawnTime * 60000
                    
                    global.con.query(`UPDATE game SET respawnTime = ${respawnTime}`, (err, row) => {
                        // Return if there is an error
                        if (err) {
                            message.channel.send("SQL Failed");
                            return console.error(err);
                        }

                        message.channel.send(`Set respawn time to ${args[1]} minutes.`);
                    });
                }

                if(commandType == "newtargettime")
                {
                    if (global.adminIDs.includes(message.author.id) == false)
                    {
                        message.channel.send("You can't do this.")
                        return;
                    }
                    if(args[1] === undefined) return;
                    let newTargetTime = parseFloat(args[1]);
                    newTargetTime = newTargetTime * 60000
                    
                    global.con.query(`UPDATE game SET newTargetTime = ${newTargetTime}`, (err, row) => {
                        // Return if there is an error
                        if (err) {
                            message.channel.send("SQL Failed");
                            return console.error(err);
                        }

                        message.channel.send(`Set new target time to ${args[1]} minutes.`);
                    });
                }
            });
        });
	},
    timerHandler(client)
    {
        console.log("Running game timers.");
        global.con.query('SELECT * FROM `players`', function(err, results, fields) {
            if(err)
            {
                message.channel.send("SQL failed.");
                return;
            }

            let players = results;
            MondayReset(client, players);

        });
    },
};

function StartGame(message, game, players)
{
    if(game.running === true)
    {
        message.channel.send("A game already exists!")
    }
    else
    {
        message.channel.send(`<@&${global.roleID}>. Starting game. Sending all current players a target in their DMs.`)

        // Start index at one and wrap around on the last player
        players = shuffle(players);
        let playerIndex = 1;
        players.forEach(playerData => {
            message.client.users.fetch(playerData.id).then(player => {
                if(player === undefined) 
                {
                    message.channel.send("Caught an undefined player.");
                }
                let targetName = "error send griffon a dm";

                // Do a bit of randomization on all other players
                //let otherPlayers = players.filter(data => data.id != playerData.id);

                //let keys = Object.values(otherPlayers);
                //let randomPlayer = keys[ keys.length * Math.random() << 0];
                let otherPlayers = players.filter(data => data.id != playerData.id);
                let randomPlayer = otherPlayers[playerIndex];
                playerIndex = playerIndex + 1;
                if(playerIndex > otherPlayers.length - 1) playerIndex = 0;

                message.client.users.fetch(randomPlayer.id).then(target => {
                    targetName = target.username;
                    
                    player.send(`Target: ${targetName}`).then(() => 
                    {
                        if (message.channel.type === "dm") return;
                    })
                    .catch((error) => 
                    {
                        // On failing, throw error.
                        console.error(
                            `Could not send DM to ${player.tag}.\n`,
                            error
                        );

                        message.channel.send(`Could not send DM to ${player.tag}.\n`);
                    });
                })


                // update player as alive and reset points
                global.con.query(`UPDATE players SET alive = true, targetid = ${randomPlayer.id}, timeToRevive = 0, timeToGetNewTarget = 0 WHERE id = ${player.id}`, (err, row) => {
                    // Return if there is an error
                    if (err) {
                        message.channel.send("SQL Failed");
                        return console.error(err);
                    }
                });
            })
        })

        // Set game running
        global.con.query(`UPDATE game SET running = true`, (err, row) => {
            // Return if there is an error
            if (err) {
                message.channel.send("SQL failed");
                return console.error(err);
            }
        });
    }
}

function EndGame(message, game)
{
    if(game.running === false)
    {
        message.channel.send("A game doesn't exist!")
    }
    else
    {
        message.channel.send(`<@&${global.roleID}>. Ending game.`)
        global.con.query(`UPDATE game SET running = false`, (err, row) => {
            // Return if there is an error
            if (err) {
                message.channel.send("SQL failed");
                return console.error(err);
            }
        });
    }
}

function MondayReset(client, players)
{
    clock.on('monday 12:00', function (date) {
        // Start index at one and wrap around on the last player
        let playerIndex = 1;
        players = shuffle(players);
        players.forEach(playerData => {
            client.users.fetch(playerData.id).then(player => {
                let targetName = "error send griffon a dm";

                let otherPlayers = players.filter(data => data.id != playerData.id);
                let randomPlayer = otherPlayers[playerIndex];
                playerIndex = playerIndex + 1;
                if(playerIndex > otherPlayers.length - 1) playerIndex = 0;

                client.users.fetch(randomPlayer.id).then(target => {
                    targetName = target.username;
                    
                    player.send(`Monday reset! New target: ${targetName}`).then(() => {})
                    .catch((error) => 
                    {
                        // On failing, throw error.
                        console.error(
                            `Could not send DM to ${player.tag}.\n`,
                            error
                        );
                    });
                })

                 // MYSQL test so I'm not writing it in every command
                global.con.ping(function (err) 
                {
                    if (err) 
                    {
                        console.log("Lost connection to MYSQL, reestablishing before we run the command.")
                        global.con = createConnection(mysql);
                        // Then we are going to connect to our MySQL database and we will test this on errors
                        global.con.connect(err => {
                            // Console log if there is an error
                            if (err) return console.log(err);

                            // No error found?
                            console.log(`MySQL has been connected!`);
                            // update player as alive and reset points
                            global.con.query(`UPDATE players SET alive = true, targetid = ${randomPlayer.id}, timeToRevive = 0, timeToGetNewTarget = 0 WHERE id = ${player.id}`, (err, row) => {
                                // Return if there is an error
                                if (err) {
                                    return console.error(err);
                                }
                            });
                        });
                    }
                    else
                    {
                        // update player as alive and reset points
                        global.con.query(`UPDATE players SET alive = true, targetid = ${randomPlayer.id}, timeToRevive = 0, timeToGetNewTarget = 0 WHERE id = ${player.id}`, (err, row) => {
                            // Return if there is an error
                            if (err) {
                                return console.error(err);
                            }
                        });
                    }
                });
            })
        })
    })

}

function shuffle(array) {
	let currentIndex = array.length,  randomIndex;
  
	// While there remain elements to shuffle.
	while (currentIndex != 0) {
  
	  // Pick a remaining element.
	  randomIndex = Math.floor(Math.random() * currentIndex);
	  currentIndex--;
  
	  // And swap it with the current element.
	  [array[currentIndex], array[randomIndex]] = [
		array[randomIndex], array[currentIndex]];
	}
  
	return array;
}
