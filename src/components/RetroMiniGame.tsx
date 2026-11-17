import { useEffect, useRef, useState, useCallback } from 'react';
import { retroAudio } from '../audio/retroAudio';

interface RetroMiniGameProps {
  active: boolean;
  onExitToTitle?: () => void;
  externalJumpSignal: number;
}

interface Obstacle {
  x: number;
  width: number;
  height: number;
  type: 'barrier' | 'card';
  collected?: boolean;
}

export function RetroMiniGame({ active, externalJumpSignal }: RetroMiniGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(400);
  const [isGameOver, setIsGameOver] = useState(false);

  const stateRef = useRef({
    playerY: 0,
    velocityY: 0,
    isJumping: false,
    obstacles: [] as Obstacle[],
    frameCount: 0,
    score: 0,
    speed: 2.3,
    isGameOver: false,
  });

  const triggerJump = useCallback(() => {
    const st = stateRef.current;
    if (st.isGameOver) {
      // Restart game cleanly
      st.playerY = 0;
      st.velocityY = 0;
      st.isJumping = false;
      st.obstacles = [];
      st.frameCount = 0;
      st.score = 0;
      st.speed = 2.3;
      st.isGameOver = false;
      setScore(0);
      setIsGameOver(false);
      retroAudio.playButtonBlip(820);
      return;
    }
    if (!st.isJumping) {
      st.velocityY = -5.4;
      st.isJumping = true;
      retroAudio.playJumpSfx();
    }
  }, []);

  // Trigger jump when external console A/Up button is pressed
  useEffect(() => {
    if (externalJumpSignal > 0 && active) {
      triggerJump();
    }
  }, [externalJumpSignal, active, triggerJump]);

  // Keyboard support inside active game
  useEffect(() => {
    if (!active) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'KeyZ') {
        e.preventDefault();
        triggerJump();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [active, triggerJump]);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const W = 240;
    const H = 160;
    const GROUND_Y = 128;

    const renderLoop = () => {
      const st = stateRef.current;
      st.frameCount++;

      // Sunset nostalgic sky gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
      skyGrad.addColorStop(0, '#120d26');
      skyGrad.addColorStop(0.55, '#592038');
      skyGrad.addColorStop(1, '#e67e35');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, GROUND_Y);

      // Retro pixel sun
      ctx.fillStyle = '#ffbe55';
      ctx.beginPath();
      ctx.arc(185, 58, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#592038';
      ctx.fillRect(165, 62, 40, 2);
      ctx.fillRect(165, 67, 40, 2);
      ctx.fillRect(165, 72, 40, 3);

      // Parallax distant city blocks
      const cityOffset = (st.frameCount * 0.4) % 80;
      ctx.fillStyle = '#25152c';
      for (let i = -1; i < 5; i++) {
        const bx = i * 80 - cityOffset;
        ctx.fillRect(bx, GROUND_Y - 26, 22, 26);
        ctx.fillRect(bx + 26, GROUND_Y - 38, 18, 38);
        ctx.fillRect(bx + 48, GROUND_Y - 19, 24, 19);
      }

      // Train roof / track surface
      ctx.fillStyle = '#181a24';
      ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
      ctx.fillStyle = '#384664';
      ctx.fillRect(0, GROUND_Y, W, 3);

      // Moving rail ties
      const tieOffset = (st.frameCount * st.speed * 1.6) % 24;
      ctx.fillStyle = '#2a3248';
      for (let i = -1; i < 12; i++) {
        ctx.fillRect(i * 24 - tieOffset, GROUND_Y + 8, 12, 3);
      }

      if (!st.isGameOver) {
        // Physics
        st.playerY += st.velocityY;
        st.velocityY += 0.34;
        if (st.playerY >= 0) {
          st.playerY = 0;
          st.velocityY = 0;
          st.isJumping = false;
        }

        // Spawn obstacles & NULLS memory cards
        if (st.frameCount % 68 === 0) {
          const isCard = Math.random() > 0.62;
          st.obstacles.push({
            x: W + 10,
            width: isCard ? 12 : 12,
            height: isCard ? 14 : 16 + Math.floor(Math.random() * 8),
            type: isCard ? 'card' : 'barrier',
          });
        }

        st.speed = Math.min(4.2, 2.3 + st.score / 900);
      }

      // Draw & update obstacles
      const px = 34;
      const py = GROUND_Y - 20 + st.playerY;

      for (let i = st.obstacles.length - 1; i >= 0; i--) {
        const obs = st.obstacles[i];
        if (!st.isGameOver) {
          obs.x -= st.speed;
        }

        if (obs.type === 'card' && !obs.collected) {
          const cy = GROUND_Y - 36;
          // Glowing NULLS cartridge / memory card
          ctx.fillStyle = '#0e63ff';
          ctx.fillRect(obs.x, cy, 11, 13);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(obs.x + 2, cy + 2, 7, 4);
          ctx.fillStyle = '#ff4444';
          ctx.fillRect(obs.x + 2, cy + 9, 7, 2);

          if (
            px < obs.x + 11 &&
            px + 14 > obs.x &&
            py < cy + 13 &&
            py + 20 > cy
          ) {
            obs.collected = true;
            st.score += 100;
            setScore(st.score);
            retroAudio.playScoreSfx();
          }
        } else if (obs.type === 'barrier') {
          const by = GROUND_Y - obs.height;
          ctx.fillStyle = '#d9383a';
          ctx.fillRect(obs.x, by, obs.width, obs.height);
          ctx.fillStyle = '#ffcf5c';
          ctx.fillRect(obs.x + 2, by + 2, obs.width - 4, 4);

          if (
            !st.isGameOver &&
            px + 2 < obs.x + obs.width - 2 &&
            px + 12 > obs.x + 2 &&
            py + 2 < GROUND_Y &&
            py + 19 > by + 2
          ) {
            st.isGameOver = true;
            setIsGameOver(true);
            setHighScore((prev) => Math.max(prev, st.score));
            retroAudio.playGameOverSfx();
          }
        }

        if (obs.x < -30) {
          st.obstacles.splice(i, 1);
          if (!st.isGameOver && obs.type === 'barrier') {
            st.score += 25;
            setScore(st.score);
          }
        }
      }

      // Draw pixel-art spiky-head hero character matching reference!
      const bob = st.isJumping ? 0 : Math.floor(st.frameCount / 7) % 2;
      // Legs (blue denim)
      ctx.fillStyle = '#244b8f';
      ctx.fillRect(px + 2, py + 13, 4, 7 - bob);
      ctx.fillRect(px + 8, py + 13, 4, 7 - (1 - bob));
      // Cream tee
      ctx.fillStyle = '#f2eadc';
      ctx.fillRect(px + 1, py + 7, 12, 7);
      // Black spiky head
      ctx.fillStyle = '#09090c';
      ctx.fillRect(px + 2, py + 1, 10, 7);
      // 3 spikes
      ctx.fillRect(px, py - 1, 3, 3);
      ctx.fillRect(px + 5, py - 3, 4, 4);
      ctx.fillRect(px + 11, py - 1, 3, 3);
      // Red headphone earcup
      ctx.fillStyle = '#e03535';
      ctx.fillRect(px + 1, py + 2, 2, 4);
      // White eyes
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px + 5, py + 3, 2, 2);
      ctx.fillRect(px + 9, py + 3, 2, 2);

      // HUD bar
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, W, 16);
      ctx.fillStyle = '#93c5fd';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.fillText(`SCR ${String(st.score).padStart(4, '0')}`, 8, 11);
      ctx.fillStyle = '#fcd34d';
      ctx.fillText(`HI ${String(Math.max(highScore, st.score)).padStart(4, '0')}`, 174, 11);

      if (st.isGameOver) {
        ctx.fillStyle = 'rgba(6, 8, 16, 0.78)';
        ctx.fillRect(28, 42, W - 56, 72);
        ctx.strokeStyle = '#1e7bff';
        ctx.lineWidth = 2;
        ctx.strokeRect(28, 42, W - 56, 72);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', W / 2, 68);

        ctx.fillStyle = '#60a5fa';
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillText('PRESS A / SPACE TO RETRY', W / 2, 92);
        ctx.textAlign = 'left';
      }

      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, [active, highScore]);

  return (
    <div
      onClick={triggerJump}
      className="relative w-full h-full cursor-pointer select-none overflow-hidden bg-[#0a0c18]"
      title="Klik layar atau tekan Spasi untuk melompat"
    >
      <canvas
        ref={canvasRef}
        width={240}
        height={160}
        className="w-full h-full object-cover [image-rendering:pixelated]"
      />
      {/* Tiny non-intrusive bottom instruction */}
      <div className="pointer-events-none absolute bottom-1 inset-x-0 flex justify-between px-2 text-[9px] font-mono-num text-white/60">
        <span>{isGameOver ? 'TAP TO RETRY' : 'TAP / SPACE: JUMP'}</span>
        <span>SCORE {score}</span>
      </div>
    </div>
  );
}
