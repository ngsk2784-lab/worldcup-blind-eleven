/**
 * 결과 공유 카드 — 1080x1350 캔버스 코드 생성(사진/외부 이미지 없음).
 */
import type { Formation, FinalXIEntry, XIScore } from '../../types';
import { positionColorHex } from '../../components/positionColors';

export function drawShareCard(
  canvas: HTMLCanvasElement,
  {
    score,
    finalXI,
    formation,
    tournamentLabel,
  }: { score: XIScore; finalXI: FinalXIEntry[]; formation: Formation; tournamentLabel: string },
) {
  const W = 1080;
  const H = 1350;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // 배경 (야간 비네트)
  const bgGrad = ctx.createRadialGradient(W / 2, H * 0.32, 100, W / 2, H * 0.32, H * 0.9);
  bgGrad.addColorStop(0, '#0d141c');
  bgGrad.addColorStop(0.55, '#0a0e14');
  bgGrad.addColorStop(1, '#06090d');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // 브랜드
  ctx.fillStyle = '#66757F';
  ctx.font = '600 26px "Noto Sans KR", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BLIND XI', W / 2, 100);
  ctx.font = '400 20px "Noto Sans KR", sans-serif';
  ctx.fillText(tournamentLabel, W / 2, 134);

  ctx.fillStyle = '#A5B4C0';
  ctx.font = '600 30px "Noto Sans KR", sans-serif';
  ctx.fillText('당신의 안목', W / 2, 200);

  // 점수
  ctx.fillStyle = '#E8B04B';
  ctx.font = '700 160px "Roboto Mono", monospace';
  ctx.fillText(String(Math.round(score.total)), W / 2, 400);

  ctx.fillStyle = '#EAF1F7';
  ctx.font = '700 48px "Oswald", sans-serif';
  ctx.fillText(`등급 ${score.grade}`, W / 2, 470);

  // 미니 피치 + XI
  const pitchX = 140;
  const pitchY = 560;
  const pitchW = W - 280;
  const pitchH = 620;
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  ctx.strokeRect(pitchX, pitchY, pitchW, pitchH);
  ctx.beginPath();
  ctx.moveTo(pitchX, pitchY + pitchH / 2);
  ctx.lineTo(pitchX + pitchW, pitchY + pitchH / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(pitchX + pitchW / 2, pitchY + pitchH / 2, 70, 0, Math.PI * 2);
  ctx.stroke();

  for (const slot of formation.slots) {
    const entry = finalXI.find((e) => e.slot.id === slot.id);
    const cx = pitchX + slot.x * pitchW;
    const cy = pitchY + slot.y * pitchH;
    const color = entry ? positionColorHex(entry.player.positionGroup) : '#33424F';
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#0A0E14';
    ctx.lineWidth = 3;
    ctx.stroke();

    if (entry) {
      ctx.fillStyle = '#0A0E14';
      ctx.font = '700 16px "Roboto Mono", monospace';
      ctx.fillText(String(entry.player.reveal.jerseyNumber ?? ''), cx, cy + 5);

      ctx.fillStyle = '#EAF1F7';
      ctx.font = '600 16px "Noto Sans KR", sans-serif';
      const shortName = entry.player.reveal.realName.split(' ').pop() ?? entry.player.reveal.realName;
      ctx.fillText(shortName, cx, cy + 46);
    }
  }

  // 하단 출처
  ctx.fillStyle = '#66757F';
  ctx.font = '400 18px "Noto Sans KR", sans-serif';
  ctx.fillText('데이터: StatsBomb Open Data', W / 2, H - 50);
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename = 'blind-xi-result.png') {
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
