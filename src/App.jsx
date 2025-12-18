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

  const generateRoomCode = () =>
    Math.floor(1000 + Math.random() * 9000).toString();

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

  const joinRoom = async () => {
    if (!roomCode.trim() || !nickname.trim())
      return alert("Enter both nickname and room code!");

    const roomRef = ref(db, `rooms/${roomCode}`);
    const snapshot = await get(roomRef);

    if (!snapshot.exists()) return alert("Room not found!");

    const roomData = snapshot.val();
    if (roomData.players?.[nickname])
      return alert("Nickname already taken!");

    await update(roomRef, { [`players/${nickname}`]: { coins: 10 } });

    setJoined(true);
    setPlayerName(nickname);
  };

  useEffect(() => {
    if (!roomCode) return;

    const roomRef = ref(db, `rooms/${roomCode}`);
    return onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      setPot(data.pot || 0);
      setPlayers(data.players || {});
      setTurn(data.turn || "");
      setLastSpin(data.lastSpin || null);

      if (data.lastSpin?.letter === "Gimel") {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      }
    });
  }, [roomCode]);

  const spinDreidel = async () => {
    if (turn !== playerName) return alert("Not your turn!");
    setSpinning(true);

    const result = sides[Math.floor(Math.random() * sides.length)];
    setRotation((prev) => prev + 720 + Math.random() * 360);

    setTimeout(async () => {
      setSpinning(false);

      const roomRef = ref(db, `rooms/${roomCode}`);
      const snapshot = await get(roomRef);
      const data = snapshot.val();
      if (!data) return;

      let { pot, players } = data;
      const player = players[playerName];
      let resultMessage = "";

      const playerNames = Object.keys(players);

      switch (result) {
        case "Nun":
          resultMessage = `${playerName} spun Nun – nothing happens.`;
          break;

        case "Hey": {
          const half = Math.floor(pot / 2);
          player.coins += half;
          pot -= half;
          resultMessage = `${playerName} spun Hey – takes half the pot.`;
          break;
        }

        case "Shin":
          player.coins -= 1;
          pot += 1;
          resultMessage = `${playerName} spun Shin – adds 1 coin to the pot.`;
          break;

        case "Gimel": {
          const payout = Math.max(pot - 1, 0);
          player.coins += payout;

          // everyone puts in 1 coin (including winner)
          playerNames.forEach((name) => {
            players[name].coins -= 1;
          });

          pot = playerNames.length;
          resultMessage = `${playerName} spun Gimel – takes ${payout} coins, everyone pays 1.`;
          break;
        }
      }

      // zero-coin extra turn rule
      let nextTurn = turn;
      if (player.coins > 0) {
        const idx = playerNames.indexOf(playerName);
        nextTurn = playerNames[(idx + 1) % playerNames.length];
      }

      await update(roomRef, {
        pot,
        players,
        turn: nextTurn,
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

  const leaveRoom = async () => {
    await remove(ref(db, `rooms/${roomCode}/players/${playerName}`));
    setJoined(false);
    setRoomCode("");
    setMessage("");
    setLastSpin(null);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-gradient-to-br from-blue-900 via-purple-700 to-pink-600 p-8 text-white font-sans">
      {showConfetti && <Confetti />}
      {/* UI UNCHANGED BELOW */}
      {/* … your existing JSX exactly as before … */}
    </div>
  );
}
