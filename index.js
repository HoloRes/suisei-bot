// Packages
const fs = require("fs"),
    Discord = require("discord.js"),
    mongoose = require("mongoose"), // Library for MongoDB
    express = require("express"), // Web server
    hbs = require("hbs"); // Handlebars

// Models
const Music = require("./models/music");

// Local config files
const config = require("./config.json");

// Init
// Express
const app = express();

app.use(express.static("public")); // Set public as static files folder, can be uses for JS and CSS files
app.set('view engine', 'hbs'); // Set the view engine to Handlebars

app.listen(3000); // Start the web server on port 3000
console.log("Express is listening");

// Mongoose
mongoose.connect(`mongodb+srv://${config.mongodb.username}:${config.mongodb.password}@${config.mongodb.host}/${config.mongodb.database}`, { useNewUrlParser: true, useUnifiedTopology: true });

// Code
// Routers
app.get('/', (req, res) => {
    res.render("index", {
        music: [
            {
                "name": "NEXT COLOR PLANET",
                "author": "Hoshimachi Suisei",
                "id": "1"
            }
        ]
    });
});

app.get('/player/:id', (req, res) => {
    const music = {
        "name": "NEXT COLOR PLANET",
        "author": "Hoshimachi Suisei",
        "id": "1"
    }
    if (req.params.id === music.id) return res.render("player", {music: music});
    else res.status(400).send("Page not found")
});

// Discord bot

// Create a Discord client
const client = new Discord.Client();

client.on("ready", () => {
    client.user.setActivity("great music", { type: "LISTENING" });
    loadcmds();
    console.log("Bot online");
});

client.on("message", (message) => {
    if(message.author.bot) return;
    if (message.content.startsWith(config.discord.prefix)) {

    }
})

client.login(config.discord.token);


// Functions
function loadcmds() {
    fs.readdir("./commands/user", (err, files) => { // Read all the files in the directory, this are the commands usable by everyone or staff
        if (err) throw (err);
        let jsfiles = files.filter(f => f.split(".").pop() === "js");
        if (jsfiles.length <= 0) {
            return console.log("No commands found.");
        }
        jsfiles.forEach((f, i) => {
            delete require.cache[require.resolve(`./commands/user/${f}`)];
            const cmd = require(`./commands/user/${f}`);
            client.commands.set(cmd.config.command, cmd);
        });
    });
    fs.readdir("./commands/dev", (err, files) => { // Commmands only available to the developer, these can break.
        if (err) throw (err);
        let jsfiles = files.filter(f => f.split(".").pop() === "js");
        if (jsfiles.length <= 0) {
            return console.log("No commands found.");
        }
        jsfiles.forEach((f, i) => {
            delete require.cache[require.resolve(`./commands/admin/${f}`)];
            const cmd = require(`./commands/dev`);
            client.admincmds.set(cmd.config.command, cmd);
        });
    });
}