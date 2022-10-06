var {spawn} = require('child_process');
require('dotenv').config();

// Discord part
const { Client, GatewayIntentBits } = require('discord.js');
const bot = new Client({ intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
]});

bot.login(process.env.token);

var ready=true;
var lastLine="";
var moves=[];

const stockFish = spawn('stockfish.exe')
stockFish.stdout.pipe(process.stdout);
stockFish.stdin.pipe(process.stdout);
stockFish.on('exit',(code,signal)=>{
    console.log("Stockfish ended with code: "+code)
})
stockFish.stdout.on('data', (data)=>{
    if (data.toString().match(/^\s*readyok\s*$/)){
        ready=true;
    }
    lines = data.toString().split("\n")
    lastLine = lines[lines.length-2]
})
stockFish.stdin.write("uci\n")


async function discordSend(text){
    bot.channels.fetch('1026957578183376899').then(channel=>{
        channel.send(text)
    }).catch(err=>{
        console.log("Channel not found");
    });
}


bot.on('messageCreate', async message => {
    if (message.author.equals(bot.user)) return;
    const testo=message.content;
    if (testo=="ID newGame"){
        stockFish.stdin.write("ucinewgame\n");
        await isReady();
        discordSend("ID newGame\nok")
        moves = [];
    }else if (testo.startsWith("ID play")){
        const righe = testo.split('\n');
        const movetime = righe[2]=="null"?null:righe[2];
        stockFish.stdin.write(`position fen '${righe[1]}'\n`);
        const move = await go(movetime);
        
        discordSend(`ID play\n${move}`);    
    }else if (testo.startsWith("ID move")){
        const righe = testo.split('\n');
        const movetime = righe[2]=="null"?null:righe[2];
        var move = testo.match(/\w\d\w\d/)?testo.match(/\w\d\w\d/)[0]:undefined;
        if (move) moves.push(move)
        stockFish.stdin.write(`position startpos${moves.length>0?' moves '+moves.join(' '):''}\n`);
        console.log(`position startpos${moves.length>0?' moves '+moves.join(' '):''}\n`)
        move = await go(movetime);
        moves.push(move)
    
        discordSend(`ID move\n${move}`)
        
    }
});

async function isReady(){
    ready=false;
    stockFish.stdin.write("isready\n");
    var promiseResolve;
    var promise = new Promise((resolve, reject)=>{
        promiseResolve = resolve;
    });

    var interval = setInterval(()=>{
        if (ready){
            promiseResolve();
            clearInterval(interval);
        }
    },100)
    await promise;
}
async function gotMove(){
    var promiseResolve;
    var promise = new Promise((resolve, reject)=>{
        promiseResolve = resolve;
    });

    var interval = setInterval(()=>{
        if (lastLine.match(/bestmove \w\d\w\d/)){
            promiseResolve();
            clearInterval(interval);
        }
    },100)
    await promise;
}


async function go(movetime){
    stockFish.stdin.write(`go movetime ${movetime||5000}\n`);
    await gotMove();
    return lastLine.match(/bestmove (\w\d\w\d)/)[1];
}



/*
funzionalità:
/newGame
    dice al motore di iniziare un nuovo game 
    ritorno: {status: "ok"}

/move
    il motore esegue la mossa ottimale e la ritorna
    ritorno: {move: "a1b2"}

/move?move=a1b2
    il motore aggiunge la mossa dell'avversario a1b1 alla cronologia, esegue la mossa ottimale e la ritorna
    ritorno: {move: "a1b2"}

/play?FEN=rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
    il motore ritorna la mossa ottimale dato lo stato della board
    ritorno: {move: "a1b2"}
*/