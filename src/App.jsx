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
  const [pot, setPot] = useState(10);
  const [players, setPlayers] = useState({});
  const [turn, setTurn] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [lastSpin, setLastSpin] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const sides = ["Nun", "Gimel", "Hey", "Shin"];

  const generateRoomCode = () =>
    Math.floor(1000 + Math.random() * 9000).toString();

  /* ---------------- CREATE ROOM ---------------- */
  const createRoom = async () => {
    if (!nickname.trim()) return alert("Enter a nickname");

    const code = generateRoomCode();
    setRoomCode(code);
    setPlayerName(nickname);
    setJoined(true);

    await set(ref(db, `rooms/${code}`), {
      pot: 10,
      turn: nickname,
      players: {
        [nickname]: { coins: 10, lastChance: false },
      },
    });
  };

  /* ---------------- JOIN ROOM ---------------- */
  const joinRoom = async () => {
    if (!nickname || !roomCode) return alert("Missing info");

    const roomRef = ref(db, `rooms/${roomCode}`);
    const snap = await get(roomRef);
    if (!snap.exists()) return alert("Room not found");

    const data = snap.val();
    if (data.players?.[nickname])
      return alert("Nickname already taken");

    await update(roomRef, {
      [`players/${nickname}`]: { coins: 10, lastChance: false },
    });

    setPlayerName(nickname);
    setJoined(true);
  };

  /* ---------------- LISTEN TO ROOM ---------------- */
  useEffect(() => {
    if (!roomCode) return;

    const roomRef = ref(db, `rooms/${roomCode}`);
    return onValue(roomRef, (snap) => {
      const data = snap.val();
      if (!data) return;

      setPot(data.pot);
      setPlayers(data.players || {});
      setTurn(data.turn);
      setLastSpin(data.lastSpin || null);

      if (data.lastSpin?.letter === "Gimel") {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 2500);
      }
    });
  }, [roomCode]);

  /* ---------------- SPIN DREIDEL ---------------- */
  const spinDreidel = async () => {
    if (turn !== playerName || spinning) return;

    setSpinning(true);
    const result = sides[Math.floor(Math.random() * sides.length)];
    setRotation((r) => r + 720 + Math.random() * 360);

    setTimeout(async () => {
      const roomRef = ref(db, `rooms/${roomCode}`);
      const snap = await get(roomRef);
      const data = snap.val();
      if (!data) return;

      let { pot, players } = data;
      let player = players[playerName];
      let message = "";

      switch (result) {
        case "Nun":
          message = `${playerName} spun Nun — nothing happens.`;
          break;

        case "Hey": {
          const half = Math.floor(pot / 2);
          player.coins += half;
          pot -= half;
          message = `${playerName} spun Hey — takes half the pot.`;
          break;
        }

        case "Shin":
          player.coins -= 1;
          pot += 1;
          message = `${playerName} spun Shin — adds one coin to the pot.`;
          break;

        case "Gimel": {
          // Take pot
          player.coins += pot;

          // Leave one coin (counts as their contribution)
          player.coins -= 1;
          pot = 1;

          // Other players add one coin
          Object.keys(players).forEach((name) => {
            if (name !== playerName) {
              players[name].coins -= 1;
              pot += 1;
            }
          });

          message = `${playerName} spun Gimel — takes the pot, everyone antes up!`;
          break;
        }
      }

      /* -------- LAST-CHANCE RULE -------- */
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

      const remaining = Object.keys(players);

      if (remaining.length === 1) {
        await update(roomRef, {
          players,
          pot,
          turn: remaining[0],
          lastSpin: {
            nickname: remaining[0],
            letter: result,
            message: `${remaining[0]} wins the game!`,
            timestamp: Date.now(),
          },
        });
        setSpinning(false);
        return;
      }

      const idx = remaining.indexOf(playerName);
      const nextPlayer = remaining[(idx + 1) % remaining.length];

      await update(roomRef, {
        players,
        pot,
        turn: nextPlayer,
        lastSpin: {
          nickname: playerName,
          letter: result,
          message,
          timestamp: Date.now(),
        },
      });

      setSpinning(false);
    }, 1200);
  };

  /* ---------------- LEAVE ROOM ---------------- */
  const leaveRoom = async () => {
    await remove(ref(db, `rooms/${roomCode}/players/${playerName}`));
    setJoined(false);
    setRoomCode("");
  };

  /* ---------------- UI ---------------- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-700 to-pink-600 text-white flex flex-col items-center p-8">
      {showConfetti && <Confetti />}
      <h1 className="text-4xl font-bold mb-6">🕎 Dreidel Multiplayer</h1>

      {!joined ? (
        <div className="bg-white/20 p-6 rounded-xl">
          <input
            className="p-2 text-black rounded mb-2 w-full"
            placeholder="Nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
          <button onClick={createRoom} className="btn">Create Room</button>
          <input
            className="p-2 text-black rounded mt-3 w-full"
            placeholder="Room Code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
          />
          <button onClick={joinRoom} className="btn mt-2">Join Room</button>
        </div>
      ) : (
        <div className="bg-white/20 p-6 rounded-xl w-full max-w-md">
          <p>Room: <b>{roomCode}</b></p>
          <p>Turn: <b>{turn}</b></p>
          <p>Pot: <b>{pot}</b></p>

          <div
            className="w-28 h-28 bg-white text-black flex items-center justify-center text-3xl rounded-full my-4"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            {lastSpin?.letter || "Spin"}
          </div>

          <button onClick={spinDreidel} className="btn w-full">
            Spin
          </button>

          <div className="mt-4 bg-white text-black p-3 rounded">
            {Object.entries(players).map(([n, p]) => (
              <p key={n}>
                {n}: {p.coins} {p.lastChance && "(LAST CHANCE)"}
              </p>
            ))}
          </div>

          <button onClick={leaveRoom} className="btn mt-4 bg-red-500">
            Leave
          </button>
        </div>
      )}
    </div>
  );
}
