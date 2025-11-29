// LAN host/client logic (host in renderer using ws, clients via browser WebSocket)
(function(){
  const LAN_PORT = 41337;
  let WebSocketServerLib = null;
  try {
    WebSocketServerLib = require('ws');
  } catch(e) {
    WebSocketServerLib = null;
  }

  let lanServer = null;
  let netClient = null;
  let remotePlayers = {};
  let localPlayerId = 'host';

  function startLanServer(world,hostState,applyBlockChange,updateRemote){
    if(!WebSocketServerLib || lanServer) return;
    try{
      lanServer = new WebSocketServerLib.Server({ port: LAN_PORT });
    }catch(e){
      console.error('LAN start failed',e);
      return;
    }
    remotePlayers = {};

    lanServer.on('connection',ws=>{
      const id='c'+Math.floor(Math.random()*1e6);
      ws.playerId=id;
      ws.on('message',data=>{
        let msg;
        try{msg=JSON.parse(data);}catch(e){return;}
        if(msg.type==='playerState'){
          remotePlayers[id]=msg.state;
          updateRemote(remotePlayers);
          broadcast({type:'playerState',id,state:msg.state},ws);
        }else if(msg.type==='blockChange'){
          applyBlockChange(msg);
          broadcast(msg,ws);
        }
      });
      ws.on('close',()=>{
        delete remotePlayers[ws.playerId];
        updateRemote(remotePlayers);
        broadcast({type:'playerLeave',id:ws.playerId},null);
      });
      const snapshot={
        type:'worldSnapshot',
        playerId:id,
        world,
        hostState,
        players:remotePlayers
      };
      ws.send(JSON.stringify(snapshot));
    });
    function broadcast(msg,except){
      const data=JSON.stringify(msg);
      for(const c of lanServer.clients){
        if(c.readyState===1 && c!==except) c.send(data);
      }
    }
    lanServer.broadcast=broadcast;
  }

  function stopLanServer(updateRemote){
    if(lanServer){
      try{lanServer.close();}catch(e){}
      lanServer=null;
    }
    remotePlayers={};
    updateRemote(remotePlayers);
  }

  function sendHostState(player){
    if(!lanServer)return;
    const msg={type:'playerState',id:'host',state:{x:player.x,y:player.y}};
    const data=JSON.stringify(msg);
    for(const c of lanServer.clients){
      if(c.readyState===1) c.send(data);
    }
  }
  function broadcastBlockFromHost(x,y,id,meta){
    if(!lanServer)return;
    const msg={type:'blockChange',x,y,id,meta:meta||0};
    const data=JSON.stringify(msg);
    for(const c of lanServer.clients){
      if(c.readyState===1) c.send(data);
    }
  }

  function joinLan(host,callbacks){
    const url='ws://'+host+':'+LAN_PORT;
    const ws = new WebSocket(url);
    netClient = ws;
    ws.onopen=()=>{};
    ws.onmessage=ev=>{
      let msg;
      try{msg=JSON.parse(ev.data);}catch(e){return;}
      if(msg.type==='worldSnapshot'){
        localPlayerId = msg.playerId;
        callbacks.onWorldSnapshot(msg);
      }else if(msg.type==='playerState'){
        if(msg.id===localPlayerId)return;
        callbacks.onRemoteState(msg.id,msg.state);
      }else if(msg.type==='blockChange'){
        callbacks.onBlockChange(msg);
      }else if(msg.type==='playerLeave'){
        callbacks.onPlayerLeave(msg.id);
      }
    };
    ws.onclose=()=>{};
  }

  function sendClientState(player){
    if(!netClient || netClient.readyState!==1) return;
    const msg={type:'playerState',id:localPlayerId,state:{x:player.x,y:player.y}};
    netClient.send(JSON.stringify(msg));
  }
  function sendClientBlockChange(x,y,id,meta){
    if(!netClient || netClient.readyState!==1) return;
    const msg={type:'blockChange',x,y,id,meta:meta||0};
    netClient.send(JSON.stringify(msg));
  }

  window.Net = {
    startLanServer,
    stopLanServer,
    sendHostState,
    broadcastBlockFromHost,
    joinLan,
    sendClientState,
    sendClientBlockChange,
    get remotePlayers(){return remotePlayers;},
    isHosting:()=>!!lanServer,
    isClient:()=>!!netClient
  };
})();
