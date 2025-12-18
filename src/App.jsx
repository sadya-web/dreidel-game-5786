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

  // Create Room
  const createRoom = async () => {
    if (!nickname.trim()) return alert("Enter your nickname!");
    const code = generateRoomCode();
    setRoomCode(code);

    await set(ref(db, `rooms/${code}`), {
      pot: 10,
      players: {
        [nickname]: { coins: 10, lastChance: false },
      },
      turn: nickname,
    });

    setJoined(true);
    setPlayerName(nickname);
  };

  // Join Room
  const joinRoom = async () => {
    if (!roomCode || !nickname) return alert("Enter nickname & room code");

    const roomRef = ref(db, `rooms/${roomCode}`);
    const snap = await get(roomRef);
    if (!snap.exists()) return alert("Room not found");

    const data = snap.val();
    if (data.players?.[nickname])
      return alert("Nickname already taken");

    await update(roomRef, {
      [`players/${nickname}`]: { coins: 10, lastChance: false },
    });

    setJoined(true);
    setPlayerName(nickname);
  };

  // Listen to room updates
  useEffect(() => {
    if (!roomCode) return;

    const unsub = onValue(ref(db, `rooms/${roomCode}`), (snap) => {
      const data = snap.val();
      if (!data) return;

      setPot(data.pot);
      setPlayers(data.players || {});
      setTurn(data.turn);
      setLastSpin(data.lastSpin || null);

      if (data.lastSpin?.letter === "Gimel") {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      }
    });

    return () => unsub();
  }, [roomCode]);

  // Spin Dreidel
  const spinDreidel = async () => {
    if (turn !== playerName) return alert("Not your turn!");
    setSpinning(true);

    const result = sides[Math.floor(Math.random() * sides.length)];
    setRotation((r) => r + 720 + Math.random() * 360);

    setTimeout(async () => {
      setSpinning(false);

      const roomRef = ref(db, `rooms/${roomCode}`);
      const snap = await get(roomRef);
      if (!snap.exists()) return;

      let { pot, players } = snap.val();
      const player = players[playerName];
      const coinsBeforeSpin = player.coins;
      let resultMessage = "";

      switch (result) {
        case "Nun":
          resultMessage = `${playerName} spun Nun – nothing happens.`;
          break;

        case "Gimel": {
          // Take pot
          player.coins += pot;

          // Leave 1 coin (counts as your ante)
          player.coins -= 1;
          pot = 1;

          // Everyone else antes 1
          Object.keys(players).forEach((name) => {
            if (name !== playerName) {
              players[name].coins -= 1;
              pot += 1;
            }
          });

          resultMessage = `${playerName} spun Gimel – takes the pot, everyone antes 1!`;
          break;
        }

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
      }

      // Handle 0-coin last-chance rule
      Object.keys(players).forEach((name) => {
        const p = players[name];

        if (p.coins === 0 && !p.lastChance) {
          p.lastChance = true;
        } else if (p.coins === 0 && p.lastChance) {
          delete players[name];
        } else if (p.coins > 0 && p.lastChance) {
          p.lastChance = false;
        }
      });

      const allPlayers = Object.keys(players);
      const currentIndex = allPlayers.indexOf(playerName);

      let nextPlayer =
        allPlayers[(currentIndex + 1) % allPlayers.length];

      // Extra turn ONLY if player had 0 and now has coins
      if (coinsBeforeSpin === 0 && player.coins > 0) {
        nextPlayer = playerName;
      }

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

  // Leave Room
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

      <h1 className="text-5xl font-bold mb-6">🕎 Dreidel Multiplayer</h1>

      {!joined ? (
        <div className="bg-white/20 rounded-2xl p-8">
          <input
            placeholder="Nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
          <button onClick={createRoom}>Create Room</button>
          <input
            placeholder="Room Code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
          />
          <button onClick={joinRoom}>Join Room</button>
        </div>
      ) : (
        <div className="bg-white/20 rounded-2xl p-6 w-full max-w-md">
          <p>Room: {roomCode}</p>
          <p>Turn: {turn}</p>
          <p>Pot: {pot}</p>

          <div
            className="w-32 h-32 bg-white text-black flex items-center justify-center rounded-full"
            style={{ rotate: `${rotation}deg` }}
          >
            {spinning ? "🎲" : lastSpin?.letter || "Spin"}
          </div>

          <button onClick={spinDreidel} disabled={spinning}>
            Spin Dreidel
          </button>

          {lastSpin && <p>{lastSpin.message}</p>}

          <h3>Players</h3>
          {Object.entries(players).map(([n, d]) => (
            <p key={n}>
              {n}: {d.coins}
            </p>
          ))}

          <button onClick={leaveRoom}>Leave</button>
        </div>
      )}
    </div>
  );
}

