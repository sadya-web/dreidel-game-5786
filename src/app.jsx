// src/App.jsx
import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { ref, set, get, update, onValue, remove } from "firebase/database";
import Confetti from "react-confetti";
import "./styles.css";

export default function App() {
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [joined, setJoined] = useState(false);
  const [message, setMessage] = useState("");
  const [pot, setPot] = useState(10);
  const [players, setPlayers] = useState({});
  const [turn, setTurn] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [lastSpin, setLastSpin] = useState(null);

  const sides = ["Nun", "Gimel", "Hey", "Shin"];

  const generateRoomCode = () => Math.floor(1000 + Math.random() * 9000).toString();

  // Create Room
  const createRoom = async () => {
    if (!nickname.trim()) return alert("Enter your nickname!");
    const code = generateRoomCode();
    setRoomCode(code);

    const roomRef = ref(db, `rooms/${code}`);
    await set(roomRef, {
      pot: 10,
      players: { [nickname]: { coins: 10 } },
      turn: nickname,
    });

    setJoined(true);
    setPlayerName(nickname);
  };

  // Join Room
  const joinRoom = async () => {
    if (!roomCode.trim() || !nickname.trim())
      return alert("Enter both nickname and room code!");

    const roomRef = ref(db, `rooms/${roomCode}`);
    const snapshot = await get(roomRef);

    if (!snapshot.exists()) return alert("Room not found!");

    const roomData = snapshot.val();
    if (roomData.players && roomData.players[nickname])
      return alert("Nickname already taken in this room!");

    await update(roomRef, { [`players/${nickname}`]: { coins: 10 } });

    setJoined(true);
    setPlayerName(nickname);
  };

  // Listen to room updates
  useEffect(() => {
    if (!roomCode) return;

    const roomRef = ref(db, `rooms/${roomCode}`);
    const unsub = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setPot(data.pot || 0);
        setPlayers(data.players || {});
        setTurn(data.turn || "");
        setLastSpin(data.lastSpin || null);

        if (data.lastSpin?.letter === "Gimel") {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 3000);
        }
      }
    });

    return () => unsub();
  }, [roomCode]);

  // Spin Dreidel
  const spinDreidel = async () => {
    if (turn !== playerName) return alert("Not your turn!");
    setSpinning(true);

    // Pick random side
    const result = sides[Math.floor(Math.random() * sides.length)];

    // Animate rotation
    const rotationAmount = 720 + Math.floor(Math.random() * 360);
    setRotation((prev) => prev + rotationAmount);

    setTimeout(async () => {
      setSpinning(false);

      const roomRef = ref(db, `rooms/${roomCode}`);
      const snapshot = await get(roomRef);
      const data = snapshot.val();
      if (!data) return;

      let { pot, players } = data;
      let player = players[playerName];
      let resultMessage = "";

      switch (result) {
        case "Nun":
          resultMessage = `${playerName} spun Nun – nothing happens.`;
          break;
        case "Gimel":
          player.coins += pot;
          pot = 0;
          resultMessage = `${playerName} spun Gimel – wins the whole pot!`;
          break;
        case "Hey":
          const half = Math.floor(pot / 2);
          player.coins += half;
          pot -= half;
          resultMessage = `${playerName} spun Hey – takes half the pot.`;
          break;
        case "Shin":
          player.coins -= 1;
          pot += 1;
          resultMessage = `${playerName} spun Shin – adds 1 coin to the pot.`;
          break;
      }

      const allPlayers = Object.keys(players);
      const currentIndex = allPlayers.indexOf(playerName);
      const nextPlayer = allPlayers[(currentIndex + 1) % allPlayers.length];

      await update(roomRef, {
        pot,
        players,
        turn: nextPlayer,
        lastSpin: {
          nickname: playerName,
          letter: result,
          message: resultMessage,
          timestamp: Date.now(),
        },
      });

      setMessage(resultMessage);
    }, 1200);
  };

  // Leave room
  const leaveRoom = async () => {
    const playerRef = ref(db, `rooms/${roomCode}/players/${playerName}`);
    await remove(playerRef);
    setJoined(false);
    setRoomCode("");
    setMessage("");
    setLastSpin(null);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-gradient-to-br from-blue-900 via-purple-700 to-pink-600 p-8 text-white font-sans">
      {showConfetti && <Confetti />}
      <h1 className="text-5xl font-bold mb-6 drop-shadow-lg">🕎 Dreidel Multiplayer</h1>

      {!joined ? (
        <div className="bg-white/20 backdrop-blur-md rounded-2xl p-8 flex flex-col items-center shadow-2xl">
          <input
            type="text"
            placeholder="Enter your nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="mb-4 p-3 rounded-lg text-black w-72 text-center font-semibold placeholder-black/60"
          />
          <div className="flex gap-4 mb-4">
            <button
              onClick={createRoom}
              className="bg-yellow-400 px-6 py-3 rounded-2xl hover:bg-yellow-500 font-bold shadow-lg transform hover:scale-105 transition"
            >
              Create Room
            </button>
            <input
              type="text"
              placeholder="Room Code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              className="p-3 rounded-lg text-black w-32 text-center font-semibold placeholder-black/60"
            />
            <button
              onClick={joinRoom}
              className="bg-green-400 px-6 py-3 rounded-2xl hover:bg-green-500 font-bold shadow-lg transform hover:scale-105 transition"
            >
              Join Room
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white/20 backdrop-blur-md rounded-2xl p-6 flex flex-col items-center shadow-2xl w-full max-w-md">
          <p className="mb-2 font-semibold">
            Room Code: <span className="text-yellow-300">{roomCode}</span>
          </p>
          <p className="mb-2 font-semibold">
            Current Turn: <span className="text-green-300">{turn}</span>
          </p>
          <p className="mb-2 font-semibold">
            Pot: <span className="text-orange-300">{pot}</span> coins
          </p>

          <div
            className={`w-32 h-32 bg-white/60 rounded-full flex items-center justify-center mb-4 text-3xl font-bold text-black shadow-xl transform transition-all duration-1200`}
            style={{ rotate: `${rotation}deg` }}
          >
            {spinning ? "🎲" : lastSpin?.letter || "Spin!"}
          </div>

          <button
            disabled={spinning}
            onClick={spinDreidel}
            className={`${
              spinning ? "bg-gray-500 cursor-not-allowed" : "bg-yellow-400 hover:bg-yellow-500"
            } px-8 py-3 mt-2 mb-2 rounded-2xl font-bold text-black shadow-lg transform hover:scale-105 transition`}
          >
            {spinning ? "Spinning..." : "Spin Dreidel"}
          </button>

          {lastSpin && (
            <p className="mb-2 text-xl font-bold text-center">{lastSpin.message}</p>
          )}

          <div className="bg-white/50 text-black rounded-xl p-4 w-full mb-4">
            <h2 className="font-bold mb-2 text-center text-lg">Players</h2>
            {Object.entries(players).map(([name, data]) => (
              <p key={name} className="text-center">{name}: {data.coins} coins</p>
            ))}
          </div>

          <button
            onClick={leaveRoom}
            className="bg-red-500 hover:bg-red-600 px-6 py-3 rounded-2xl font-bold shadow-lg transform hover:scale-105 transition"
          >
            Leave Room
          </button>
        </div>
      )}
    </div>
  );
}
