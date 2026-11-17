/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX, RotateCcw, Power, Play } from 'lucide-react';
import {
  AnimationStage,
  ScreenFilter,
  ShellVariant,
} from './components/HandheldDevice';
import { CameraMode, TrainCharacterScene } from './components/TrainCharacterScene';
import { ReferenceModal } from './components/ReferenceModal';
import { retroAudio } from './audio/retroAudio';

const STAGE_STEPS: { id: AnimationStage; label: string }[] = [
  { id: 'IDLE', label: '1. Menunggu' },
  { id: 'REACHING_POWER', label: '2. Tekan Power' },
  { id: 'BOOTING_NULLS', label: '3. Layar NULLS' },
  { id: 'TITLE_SCREEN', label: '4. Siap Main' },
];

export default function App() {
  const [stage, setStage] = useState<AnimationStage>('IDLE');
  const [cameraMode, setCameraMode] = useState<CameraMode>('auto');
  const [shellVariant, setShellVariant] = useState<ShellVariant>('classic-red');
  const [screenFilter, setScreenFilter] = useState<ScreenFilter>('crt');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isRefOpen, setIsRefOpen] = useState<boolean>(false);
  const [jumpSignal, setJumpSignal] = useState<number>(0);

  const timersRef = useRef<number[]>([]);

  const clearSequenceTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, delayMs: number) => {
    const id = window.setTimeout(fn, delayMs);
    timersRef.current.push(id);
  }, []);

  // Full cinematic boot sequence: Idle -> Reach Power -> Flash -> NULLS Boot -> Title Screen
  const startBootSequence = useCallback(
    (withAudioUnlock = true) => {
      clearSequenceTimers();
      if (withAudioUnlock) {
        retroAudio.unlock();
        if (!isMuted) {
          retroAudio.startTrainAmbience();
        }
      }

      setStage('IDLE');

      schedule(() => {
        setStage('REACHING_POWER');
      }, 650);

      schedule(() => {
        retroAudio.playPowerSwitchClick();
        setStage('POWER_FLASH');
      }, 1350);

      schedule(() => {
        retroAudio.playScreenStaticWarmup();
        setStage('BOOTING_NULLS');
        retroAudio.playNullsBootChime();
      }, 1780);

      schedule(() => {
        setStage('TITLE_SCREEN');
      }, 4500);
    },
    [clearSequenceTimers, schedule, isMuted]
  );

  // Auto-play the animation smoothly once on initial mount
  useEffect(() => {
    startBootSequence(false);
    return () => {
      clearSequenceTimers();
      retroAudio.stopTrainAmbience();
    };
  }, [startBootSequence, clearSequenceTimers]);

  // Unlock browser audio on first pointer or key interaction
  useEffect(() => {
    const unlockOnce = () => {
      retroAudio.unlock();
      if (!retroAudio.getMuted()) {
        retroAudio.startTrainAmbience();
      }
      window.removeEventListener('pointerdown', unlockOnce);
      window.removeEventListener('keydown', unlockOnce);
    };
    window.addEventListener('pointerdown', unlockOnce);
    window.addEventListener('keydown', unlockOnce);
    return () => {
      window.removeEventListener('pointerdown', unlockOnce);
      window.removeEventListener('keydown', unlockOnce);
    };
  }, []);

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    retroAudio.setMuted(nextMuted);
    if (!nextMuted) {
      retroAudio.unlock();
      retroAudio.startTrainAmbience();
      retroAudio.playButtonBlip(740);
    }
  };

  const handlePowerPress = () => {
    retroAudio.unlock();
    if (!isMuted) retroAudio.startTrainAmbience();

    if (stage === 'IDLE') {
      clearSequenceTimers();
      setStage('REACHING_POWER');
      schedule(() => {
        retroAudio.playPowerSwitchClick();
        setStage('POWER_FLASH');
      }, 520);
      schedule(() => {
        retroAudio.playScreenStaticWarmup();
        setStage('BOOTING_NULLS');
        retroAudio.playNullsBootChime();
      }, 920);
      schedule(() => {
        setStage('TITLE_SCREEN');
      }, 3600);
    } else {
      // Replay from beginning
      startBootSequence(true);
    }
  };

  const handleStartGame = () => {
    retroAudio.unlock();
    retroAudio.playButtonBlip(920);
    clearSequenceTimers();
    setStage('PLAYING');
  };

  const handleActionButton = () => {
    retroAudio.unlock();
    if (stage === 'IDLE') {
      handlePowerPress();
      return;
    }
    if (stage === 'TITLE_SCREEN') {
      handleStartGame();
      return;
    }
    if (stage === 'PLAYING') {
      setJumpSignal((prev) => prev + 1);
      return;
    }
    retroAudio.playButtonBlip(620);
  };

  const handleJumpToStage = (targetStage: AnimationStage) => {
    clearSequenceTimers();
    retroAudio.unlock();
    if (!isMuted) retroAudio.startTrainAmbience();

    if (targetStage === 'IDLE') {
      setStage('IDLE');
    } else if (targetStage === 'REACHING_POWER') {
      setStage('REACHING_POWER');
      schedule(() => {
        retroAudio.playPowerSwitchClick();
        setStage('POWER_FLASH');
      }, 500);
      schedule(() => {
        retroAudio.playScreenStaticWarmup();
        setStage('BOOTING_NULLS');
        retroAudio.playNullsBootChime();
      }, 900);
      schedule(() => {
        setStage('TITLE_SCREEN');
      }, 3600);
    } else if (targetStage === 'BOOTING_NULLS') {
      retroAudio.playScreenStaticWarmup();
      setStage('BOOTING_NULLS');
      retroAudio.playNullsBootChime();
      schedule(() => {
        setStage('TITLE_SCREEN');
      }, 2800);
    } else if (targetStage === 'TITLE_SCREEN') {
      retroAudio.playButtonBlip(780);
      setStage('TITLE_SCREEN');
    }
  };

  const isOffOrBooting = stage === 'IDLE' || stage === 'REACHING_POWER';

  return (
    <div className="min-h-screen flex flex-col bg-[#09080c] text-[#f5efe6]">
      {/* Top Bar Contract: 3 Zones (Brand — 4 single-line links — 1 primary CTA) */}
      <header className="w-full border-b border-white/10 bg-[#0d0c12]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-8 px-4 sm:px-6 py-3.5">
          {/* Zone 1: Single-line Brand Wordmark */}
          <a
            href="#stage"
            onClick={(e) => {
              e.preventDefault();
              setCameraMode('auto');
            }}
            className="font-display text-lg font-bold tracking-tight text-[#f5efe6] whitespace-nowrap shrink-0"
          >
            Nulls Nostalgia
          </a>

          {/* Zone 2: Clean Typography Navigation Links */}
          <nav
            aria-label="Mode Tampilan"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-[#b5ada1]"
          >
            <button
              type="button"
              onClick={() => setCameraMode('auto')}
              className={`whitespace-nowrap shrink-0 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1 py-1 ${
                cameraMode === 'auto' ? 'text-white underline underline-offset-8 decoration-blue-500 decoration-2' : ''
              }`}
            >
              Mode Otomatis
            </button>
            <button
              type="button"
              onClick={() => setCameraMode('scene')}
              className={`whitespace-nowrap shrink-0 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1 py-1 ${
                cameraMode === 'scene' ? 'text-white underline underline-offset-8 decoration-blue-500 decoration-2' : ''
              }`}
            >
              Adegan Kereta
            </button>
            <button
              type="button"
              onClick={() => setCameraMode('closeup')}
              className={`whitespace-nowrap shrink-0 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1 py-1 ${
                cameraMode === 'closeup' ? 'text-white underline underline-offset-8 decoration-blue-500 decoration-2' : ''
              }`}
            >
              Fokus Konsol
            </button>
            <button
              type="button"
              onClick={() => setIsRefOpen(true)}
              className="whitespace-nowrap shrink-0 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1 py-1"
            >
              Referensi Visual
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action Button */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => startBootSequence(true)}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#1560ff] px-4 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-[#236cff] active:scale-[0.98] transition-all whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
            >
              {isOffOrBooting ? (
                <>
                  <Power className="h-4 w-4" />
                  <span>Nyalakan Konsol</span>
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" />
                  <span>Putar Ulang</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Viewport Stage */}
      <main id="stage" className="flex-1 flex flex-col justify-between mx-auto w-full max-w-[1400px] px-4 sm:px-6 py-4 sm:py-5 gap-4">
        {/* Dominant Cinematic Animation Canvas */}
        <section
          aria-label="Panggung Animasi Nostalgia"
          className="relative flex-1 min-h-[460px] sm:min-h-[560px] lg:min-h-[610px] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#121116] shadow-[0_24px_70px_rgba(0,0,0,0.65)]"
        >
          <TrainCharacterScene
            stage={stage}
            cameraMode={cameraMode}
            shellVariant={shellVariant}
            screenFilter={screenFilter}
            onPowerPress={handlePowerPress}
            onStartGame={handleStartGame}
            onActionButton={handleActionButton}
            jumpSignal={jumpSignal}
          />

          {/* Quiet Floating Bottom-Left Scene Caption (unboxed, clean typography) */}
          <div className="pointer-events-none absolute left-4 bottom-4 sm:left-6 sm:bottom-5 z-30 flex flex-col gap-0.5 drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]">
            <p className="font-display text-sm sm:text-base font-semibold text-[#f5efe6]">
              {stage === 'IDLE' && 'Kereta Senja · Menunggu Konsol Dinyalakan'}
              {stage === 'REACHING_POWER' && 'Menekan Sakelar Daya...'}
              {stage === 'POWER_FLASH' && 'Menghidupkan Layar...'}
              {stage === 'BOOTING_NULLS' && 'NULLS System Boot'}
              {stage === 'TITLE_SCREEN' && 'Dusk Rail ’98 · Tekan Start untuk Bermain'}
              {stage === 'PLAYING' && 'Sedang Bermain · Dusk Rail ’98'}
            </p>
            <div className="flex items-center gap-2 text-xs text-[#d6cec2]/85">
              <span>Konsol {shellVariant === 'classic-red' ? 'Merah Klasik' : 'Transparan PCB'}</span>
              <span aria-hidden="true">·</span>
              <span>Filter {screenFilter.toUpperCase()}</span>
            </div>
          </div>

          {/* Quick Play CTA when in Title Screen on Scene View */}
          {stage === 'TITLE_SCREEN' && cameraMode === 'scene' && (
            <button
              type="button"
              onClick={() => {
                setCameraMode('closeup');
                handleStartGame();
              }}
              className="absolute right-4 bottom-4 sm:right-6 sm:bottom-5 z-30 inline-flex h-10 items-center gap-2 rounded-lg bg-[#1560ff] px-4 text-xs font-semibold text-white shadow-lg hover:bg-[#236cff] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Mulai Bermain</span>
            </button>
          )}
        </section>

        {/* Functional Stage & Hardware Controls Dock */}
        <section
          aria-label="Kontrol Animasi dan Konsol"
          className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#121118] p-3.5 sm:px-5"
        >
          {/* Timeline / Animation Stages */}
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Tahap Animasi">
            {STAGE_STEPS.map((step) => {
              const isActive =
                stage === step.id ||
                (step.id === 'REACHING_POWER' && stage === 'POWER_FLASH') ||
                (step.id === 'TITLE_SCREEN' && stage === 'PLAYING');
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => handleJumpToStage(step.id)}
                  className={`h-10 px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    isActive
                      ? 'bg-[#1560ff] text-white'
                      : 'bg-white/[0.04] text-[#b8b0a4] hover:bg-white/[0.08] hover:text-white'
                  }`}
                >
                  {step.label}
                </button>
              );
            })}
          </div>

          {/* Hardware Shell, Screen Filter, Camera Mobile Fallback & Audio Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Mobile-accessible Camera Selector */}
            <div className="flex md:hidden items-center gap-1 bg-white/[0.04] p-1 rounded-lg">
              {(['auto', 'scene', 'closeup'] as CameraMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setCameraMode(mode)}
                  className={`h-9 px-2.5 rounded-md text-xs font-medium whitespace-nowrap ${
                    cameraMode === mode ? 'bg-white/15 text-white' : 'text-[#b5ada1]'
                  }`}
                >
                  {mode === 'auto' ? 'Auto' : mode === 'scene' ? 'Kereta' : 'Konsol'}
                </button>
              ))}
            </div>

            {/* Shell Edition Switcher (Image 1 Red vs Image 2 Translucent PCB) */}
            <div className="flex items-center gap-1 rounded-lg bg-white/[0.04] p-1" role="group" aria-label="Edisi Cangkang Konsol">
              <button
                type="button"
                onClick={() => {
                  retroAudio.playButtonBlip(640);
                  setShellVariant('classic-red');
                }}
                className={`h-8 px-3 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  shellVariant === 'classic-red'
                    ? 'bg-[#b52c26] text-white'
                    : 'text-[#b8b0a4] hover:text-white'
                }`}
              >
                Merah Klasik
              </button>
              <button
                type="button"
                onClick={() => {
                  retroAudio.playButtonBlip(700);
                  setShellVariant('translucent-pcb');
                }}
                className={`h-8 px-3 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  shellVariant === 'translucent-pcb'
                    ? 'bg-[#6b2a30] text-white'
                    : 'text-[#b8b0a4] hover:text-white'
                }`}
              >
                Transparan PCB
              </button>
            </div>

            {/* Screen Filter Switcher */}
            <div className="flex items-center gap-1 rounded-lg bg-white/[0.04] p-1" role="group" aria-label="Filter Layar">
              {(['crt', 'lcd', 'clean'] as ScreenFilter[]).map((flt) => (
                <button
                  key={flt}
                  type="button"
                  onClick={() => {
                    retroAudio.playButtonBlip(690);
                    setScreenFilter(flt);
                  }}
                  className={`h-8 px-2.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    screenFilter === flt
                      ? 'bg-white/15 text-white'
                      : 'text-[#b8b0a4] hover:text-white'
                  }`}
                >
                  {flt === 'crt' ? 'CRT' : flt === 'lcd' ? 'LCD' : 'Bersih'}
                </button>
              ))}
            </div>

            {/* Audio Toggle */}
            <button
              type="button"
              onClick={handleToggleMute}
              aria-label={isMuted ? 'Aktifkan suara retro' : 'Bisukan suara retro'}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/12 bg-white/[0.04] px-3.5 text-xs font-medium text-[#e6dfd4] hover:bg-white/[0.09] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {isMuted ? (
                <>
                  <VolumeX className="h-4 w-4 text-[#a69f94]" />
                  <span>Bisu</span>
                </>
              ) : (
                <>
                  <Volume2 className="h-4 w-4 text-blue-400" />
                  <span>Suara Aktif</span>
                </>
              )}
            </button>
          </div>
        </section>
      </main>

      <ReferenceModal open={isRefOpen} onClose={() => setIsRefOpen(false)} />
    </div>
  );
}
