/**
 * OllamaSprite Component
 *
 * Renders the Ollama character at their desk (orange-colored, right of boss).
 * Simplified from BossSprite — no bubble, no phone, no sunglasses, no isAway.
 */

"use client";

import { memo, useMemo, useCallback, useState, type ReactNode } from "react";
import { useTick } from "@pixi/react";
import { Graphics, Texture } from "pixi.js";
import type { Position } from "@/types";

// ============================================================================
// TYPES
// ============================================================================

export interface OllamaSpriteProps {
  position: Position;
  isTyping?: boolean;
  chairTexture: Texture | null;
  deskTexture: Texture | null;
  keyboardTexture: Texture | null;
  monitorTexture: Texture | null;
  headsetTexture: Texture | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const OLLAMA_WIDTH = 48;
const OLLAMA_HEIGHT = 80;
const STROKE_WIDTH = 4;
const OLLAMA_COLOR = 0xf97316; // orange-500

// ============================================================================
// DRAWING FUNCTIONS
// ============================================================================

function drawOllamaBody(g: Graphics): void {
  g.clear();
  const innerWidth = OLLAMA_WIDTH - STROKE_WIDTH;
  const innerHeight = OLLAMA_HEIGHT - STROKE_WIDTH;
  const radius = innerWidth / 2;
  g.roundRect(-innerWidth / 2, -innerHeight / 2, innerWidth, innerHeight, radius);
  g.fill(OLLAMA_COLOR);
  g.stroke({ width: STROKE_WIDTH, color: 0xffffff });
}

function drawRightArm(g: Graphics, animOffset: number = 0): void {
  g.clear();
  const armWidth = 4;
  const startX = (OLLAMA_WIDTH - STROKE_WIDTH) / 2;
  const startY = 0;
  const cp1X = startX + 20;
  const cp1Y = startY + 10 + animOffset * 0.5;
  const cp2X = startX + 15;
  const cp2Y = 28 + animOffset * 0.7;
  const endX = 12;
  const endY = 32 + animOffset;

  g.moveTo(startX, startY);
  g.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, endY);
  g.stroke({ width: armWidth, color: 0xffffff, cap: "round" });

  const handWidth = 10;
  const handHeight = 14;
  g.roundRect(endX - handWidth / 2, endY - handHeight / 2, handWidth, handHeight, handWidth / 2);
  g.fill(OLLAMA_COLOR);
  g.stroke({ width: 2, color: 0xffffff });
}

function drawLeftArm(g: Graphics, animOffset: number = 0): void {
  g.clear();
  const armWidth = 4;
  const startX = -(OLLAMA_WIDTH - STROKE_WIDTH) / 2;
  const startY = 0;
  const cp1X = startX - 20;
  const cp1Y = startY + 10 + animOffset * 0.5;
  const cp2X = startX - 15;
  const cp2Y = 28 + animOffset * 0.7;
  const endX = -12;
  const endY = 32 + animOffset;

  g.moveTo(startX, startY);
  g.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, endY);
  g.stroke({ width: armWidth, color: 0xffffff, cap: "round" });

  const handWidth = 10;
  const handHeight = 14;
  g.roundRect(endX - handWidth / 2, endY - handHeight / 2, handWidth, handHeight, handWidth / 2);
  g.fill(OLLAMA_COLOR);
  g.stroke({ width: 2, color: 0xffffff });
}

function drawFallbackChair(g: Graphics): void {
  g.clear();
  g.circle(0, 15, 25);
  g.fill(0x4a5568);
  g.stroke({ width: 2, color: 0x2d3748 });
}

function drawFallbackDesk(g: Graphics): void {
  g.clear();
  g.rect(-70, 15, 140, 80);
  g.fill(0x5d3a1e);
  g.stroke({ width: 4, color: 0x3d2a1e });
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function OllamaSpriteComponent({
  position,
  isTyping = false,
  chairTexture,
  deskTexture,
  keyboardTexture,
  monitorTexture,
  headsetTexture,
}: OllamaSpriteProps): ReactNode {
  const [typingTime, setTypingTime] = useState(0);

  useTick((ticker) => {
    if (isTyping) {
      setTypingTime((t) => t + ticker.deltaTime * 0.15);
    } else {
      setTypingTime(0);
    }
  });

  const rightArmOffset = isTyping ? Math.sin(typingTime * 8) * 2 : 0;
  const leftArmOffset = isTyping ? Math.sin(typingTime * 8 + Math.PI * 0.7) * 2 : 0;

  const drawBodyCallback = useMemo(() => (_g: Graphics) => drawOllamaBody(_g), []);

  const drawRightArmCallback = useCallback(
    (g: Graphics) => drawRightArm(g, rightArmOffset),
    [rightArmOffset],
  );

  const drawLeftArmCallback = useCallback(
    (g: Graphics) => drawLeftArm(g, leftArmOffset),
    [leftArmOffset],
  );

  return (
    <pixiContainer x={position.x} y={position.y}>
      {/* Chair - behind everything */}
      {chairTexture ? (
        <pixiSprite texture={chairTexture} anchor={0.5} x={5} y={30} scale={0.1386} />
      ) : (
        <pixiGraphics draw={drawFallbackChair} />
      )}

      {/* Body */}
      <pixiContainer y={6}>
        <pixiGraphics draw={drawBodyCallback} />
      </pixiContainer>

      {/* Desk surface */}
      {deskTexture ? (
        <pixiSprite texture={deskTexture} anchor={{ x: 0.5, y: 0 }} y={30} scale={0.105} />
      ) : (
        <pixiGraphics draw={drawFallbackDesk} />
      )}

      {/* Keyboard */}
      {keyboardTexture && (
        <pixiSprite texture={keyboardTexture} anchor={0.5} x={0} y={42} scale={0.04} />
      )}

      {/* Arms */}
      <pixiContainer y={6}>
        <pixiGraphics draw={drawRightArmCallback} />
        <pixiGraphics draw={drawLeftArmCallback} />
      </pixiContainer>

      {/* Headset */}
      {headsetTexture && (
        <pixiSprite
          texture={headsetTexture}
          anchor={0.5}
          x={0}
          y={6 - 20}
          scale={{ x: 0.66825, y: 0.675 }}
        />
      )}

      {/* Monitor */}
      {monitorTexture && (
        <pixiSprite texture={monitorTexture} anchor={0.5} x={-45} y={27} scale={0.08} />
      )}

      {/* Label */}
      <pixiContainer y={-63} scale={0.5}>
        <pixiText
          text="Ollama"
          anchor={0.5}
          style={{
            fontFamily: "monospace",
            fontSize: 24,
            fill: 0xff9900,
            fontWeight: "bold",
            stroke: { width: 4, color: 0x000000 },
          }}
          resolution={2}
        />
      </pixiContainer>
    </pixiContainer>
  );
}

export const OllamaSprite = memo(OllamaSpriteComponent);
