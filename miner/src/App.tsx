import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { GameState } from './types';
import Header from './components/Header';
import HUD from './components/HUD';
import GameGrid from './components/GameGrid';
import Footer from './components/Footer';
import Tooltip from './components/Tooltip';
import { PROTOCOL } from './protocol';

function App() {
  const [gameState, setGameState] = useState<GameState>({
    balance: 0,
    netWin: 0,
    betPerClick: 0,        // renamed from betAmount
    totalWin: 0,
    totalBet: 0,           // new field
    isGameActive: false,
    isEnergized: false,
    isBetLocked: false,
    message: 'Connecting...',
    cells: [],
    activeGlobals: [],     // new field
    globalStack: 1.0,      // new field
    bombCount: 0,          // new field
    revealedCount: 0       // new field
  });

  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: '' });
  const wsRef = useRef<WebSocket | null>(null);

  // connect websocket
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8080/ws');
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      setGameState(prev => ({ ...prev, message: 'Connected. Click Start.' }));
    };

    ws.onmessage = (ev) => {
      const buf = new Uint8Array(ev.data as ArrayBuffer);
      const type = buf[0];
      if (type === PROTOCOL.MSG.STATE) {
        parseState(buf);
      } else if (type === PROTOCOL.MSG.ERROR) {
        const len = buf[1];
        const msg = new TextDecoder().decode(buf.slice(2, 2 + len));
        setGameState(prev => ({ ...prev, message: msg }));
      }
    };

    ws.onclose = () => {
      setGameState(prev => ({ ...prev, message: 'Disconnected' }));
    };

    return () => { ws.close(); };
  }, []);

  const parseState = (buf: Uint8Array) => {
    if (buf.length < 25) return; // Updated minimum length for new fields
    const cellCount = buf[2];
    const balance = (buf[3] | (buf[4] << 8) | (buf[5] << 16) | (buf[6] << 24)) << 0;
    const netWin = (buf[7] | (buf[8] << 8) | (buf[9] << 16) | (buf[10] << 24)) << 0;
    const betPerClick = (buf[11] | (buf[12] << 8) | (buf[13] << 16) | (buf[14] << 24)) << 0;
    const totalWin = (buf[15] | (buf[16] << 8) | (buf[17] << 16) | (buf[18] << 24)) << 0;
    const totalBet = (buf[19] | (buf[20] << 8) | (buf[21] << 16) | (buf[22] << 24)) << 0;
    const flags = buf[23];

    // Parse global stack (4 bytes float32)
    const globalStackBytes = new Uint8Array([buf[24], buf[25], buf[26], buf[27]]);
    const globalStack = new DataView(globalStackBytes.buffer).getFloat32(0, true);

    const bombCount = buf[28];
    const revealedCount = buf[29];
    const activeGlobalsCount = buf[30];
    const msgLen = buf[31];
    const msgStart = 32;
    const msgEnd = msgStart + msgLen;
    const message = new TextDecoder().decode(buf.slice(msgStart, msgEnd));

    // Parse active globals
    let off = msgEnd;
    const activeGlobals: any[] = [];
    for (let i = 0; i < activeGlobalsCount; i++) {
      activeGlobals.push({
        tier: buf[off],
        remaining: buf[off + 1],
        cellIndex: buf[off + 2]
      });
      off += 3;
    }

    // Parse cells
    const cells: any[] = [];
    for (let i = 0; i < cellCount; i++) {
      const cflags = buf[off];
      const amount = buf[off + 1] | (buf[off + 2] << 8);
      const multRaw = buf[off + 3] | (buf[off + 4] << 8);
      const bonusTimer = buf[off + 5];
      const globalTier = buf[off + 6];
      cells.push({
        id: i,
        type: (cflags >> 4) & 0x07,  // 3 bits for type (0-4)
        amount,
        multiplier: multRaw / 100,
        isOpen: (cflags & 1) !== 0,
        isStrike: (cflags & (1 << 1)) !== 0,
        isDisabled: (cflags & (1 << 2)) !== 0,
        isWiggling: (cflags & (1 << 3)) !== 0,
        isBonusExhausted: (cflags & (1 << 6)) !== 0,
        bonusTimer: bonusTimer || undefined,
        globalTier: globalTier || undefined,
      });
      off += 7; // Updated to 7 bytes per cell
    }

    setGameState({
      balance,
      netWin,
      betPerClick,
      totalWin,
      totalBet,
      isGameActive: (flags & 1) !== 0,
      isBetLocked: (flags & (1 << 1)) !== 0,
      isEnergized: (flags & (1 << 2)) !== 0,
      message,
      cells,
      activeGlobals,
      globalStack,
      bombCount,
      revealedCount,
    });
  };

  const send = useCallback((bytes: Uint8Array) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(bytes);
    }
  }, []);

  const startGame = useCallback(() => send(new Uint8Array([PROTOCOL.OPCODES.START])), [send]);
  const cashOut = useCallback(() => send(new Uint8Array([PROTOCOL.OPCODES.CASH_OUT])), [send]);
  const adjustBet = useCallback((delta: number) => {
    const buf = new ArrayBuffer(3);
    const view = new DataView(buf);
    view.setUint8(0, PROTOCOL.OPCODES.ADJUST_BET);
    view.setInt16(1, delta, true);
    send(new Uint8Array(buf));
  }, [send]);
  const handleCellClick = useCallback((id: number) => {
    send(new Uint8Array([PROTOCOL.OPCODES.OPEN_CELL, id]));
  }, [send]);

  const showTooltip = useCallback((x: number, y: number, content: string) => {
    setTooltip({ visible: true, x, y, content });
  }, []);
  const hideTooltip = useCallback(() => setTooltip(t => ({ ...t, visible: false })), []);

  return (
    <div className={`app ${gameState.isEnergized ? 'energized' : ''}`}>
      <Header />
      <HUD
        gameState={gameState}
        onAdjustBet={adjustBet}
        onStart={startGame}
        onCashOut={cashOut}
      />
      <main>
        <GameGrid
          cells={gameState.cells}
          onCellClick={handleCellClick}
          onShowTooltip={showTooltip}
          onHideTooltip={hideTooltip}
        />
      </main>
      <Footer />
      <Tooltip
        visible={tooltip.visible}
        x={tooltip.x}
        y={tooltip.y}
        content={tooltip.content}
      />
    </div>
  );
}

export default App;
