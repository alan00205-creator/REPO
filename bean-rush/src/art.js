// Hand-drawn canvas art shared by textures and the HUD.

// Fruits in FRUITS order: 西瓜 香蕉 鳳梨 芒果 葡萄 草莓
export function drawFruit(g, id, cx, cy, R) {
  g.save();
  g.translate(cx, cy);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const outline = (w = R * 0.07) => { g.lineWidth = w; g.strokeStyle = '#3b2a4a'; g.stroke(); };
  switch (id) {
    case 0: { // watermelon slice
      g.rotate(-0.15);
      g.beginPath(); g.arc(0, -R * 0.25, R * 0.95, 0.05 * Math.PI, 0.95 * Math.PI); g.closePath();
      g.fillStyle = '#3fae4f'; g.fill(); outline();
      g.beginPath(); g.arc(0, -R * 0.25, R * 0.82, 0.06 * Math.PI, 0.94 * Math.PI); g.closePath();
      g.fillStyle = '#eafbd8'; g.fill();
      g.beginPath(); g.arc(0, -R * 0.25, R * 0.74, 0.07 * Math.PI, 0.93 * Math.PI); g.closePath();
      g.fillStyle = '#ff4d5e'; g.fill();
      g.fillStyle = '#2a1a22';
      for (const [x, y] of [[-0.35, 0.05], [0, 0.18], [0.35, 0.05], [-0.15, 0.32], [0.17, 0.32], [0, -0.02]]) {
        g.beginPath(); g.ellipse(x * R, y * R, R * 0.05, R * 0.08, 0, 0, Math.PI * 2); g.fill();
      }
      break;
    }
    case 1: { // banana
      g.rotate(-0.4);
      g.beginPath();
      g.moveTo(-R * 0.85, -R * 0.2);
      g.quadraticCurveTo(0, R * 0.95, R * 0.85, -R * 0.35);
      g.quadraticCurveTo(R * 0.6, R * 0.05, 0, R * 0.25);
      g.quadraticCurveTo(-R * 0.5, R * 0.25, -R * 0.85, -R * 0.2);
      g.fillStyle = '#ffd83a'; g.fill(); outline();
      g.beginPath(); g.moveTo(-R * 0.6, -R * 0.02); g.quadraticCurveTo(0, R * 0.55, R * 0.6, -R * 0.15);
      g.strokeStyle = '#f2b51a'; g.lineWidth = R * 0.06; g.stroke();
      g.beginPath(); g.moveTo(R * 0.85, -R * 0.35); g.lineTo(R * 0.95, -R * 0.52);
      g.strokeStyle = '#6b4a2b'; g.lineWidth = R * 0.12; g.stroke();
      break;
    }
    case 2: { // pineapple
      g.fillStyle = '#3fae4f';
      for (const a of [-0.5, -0.2, 0.1, 0.4]) {
        g.save(); g.rotate(a);
        g.beginPath(); g.moveTo(-R * 0.12, -R * 0.35); g.lineTo(0, -R * 1.0); g.lineTo(R * 0.12, -R * 0.35); g.closePath();
        g.fill(); outline(R * 0.05);
        g.restore();
      }
      g.beginPath(); g.ellipse(0, R * 0.2, R * 0.52, R * 0.68, 0, 0, Math.PI * 2);
      g.fillStyle = '#ffb627'; g.fill(); outline();
      g.save(); g.clip();
      g.strokeStyle = '#d9821a'; g.lineWidth = R * 0.05;
      for (let i = -4; i <= 4; i++) {
        g.beginPath(); g.moveTo(i * R * 0.25 - R, -R); g.lineTo(i * R * 0.25 + R, R * 1.4); g.stroke();
        g.beginPath(); g.moveTo(i * R * 0.25 + R, -R); g.lineTo(i * R * 0.25 - R, R * 1.4); g.stroke();
      }
      g.restore();
      break;
    }
    case 3: { // mango
      g.rotate(0.35);
      g.beginPath();
      g.moveTo(0, -R * 0.8);
      g.bezierCurveTo(R * 0.85, -R * 0.75, R * 0.85, R * 0.75, 0, R * 0.82);
      g.bezierCurveTo(-R * 0.7, R * 0.82, -R * 0.75, -R * 0.1, -R * 0.35, -R * 0.55);
      g.closePath();
      const gr = g.createLinearGradient(-R, -R, R, R);
      gr.addColorStop(0, '#ff6b3d'); gr.addColorStop(0.5, '#ffab2e'); gr.addColorStop(1, '#ffd23a');
      g.fillStyle = gr; g.fill(); outline();
      g.beginPath(); g.moveTo(-R * 0.1, -R * 0.78); g.quadraticCurveTo(-R * 0.45, -R * 1.05, -R * 0.6, -R * 0.9);
      g.quadraticCurveTo(-R * 0.3, -R * 0.7, -R * 0.1, -R * 0.78);
      g.fillStyle = '#3fae4f'; g.fill(); outline(R * 0.04);
      g.beginPath(); g.ellipse(R * 0.25, -R * 0.25, R * 0.12, R * 0.2, 0.3, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.55)'; g.fill();
      break;
    }
    case 4: { // grapes
      const pts = [[-0.36, -0.3], [0, -0.32], [0.36, -0.3], [-0.18, 0.02], [0.18, 0.02], [0, 0.34], [-0.36, 0.3], [0.36, 0.3], [0, 0.66]];
      for (const [x, y] of pts) {
        g.beginPath(); g.arc(x * R, y * R, R * 0.24, 0, Math.PI * 2);
        g.fillStyle = '#8f5bd8'; g.fill(); outline(R * 0.05);
        g.beginPath(); g.arc(x * R - R * 0.07, y * R - R * 0.08, R * 0.06, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.6)'; g.fill();
      }
      g.beginPath(); g.moveTo(0, -R * 0.55); g.lineTo(R * 0.1, -R * 0.9);
      g.strokeStyle = '#6b4a2b'; g.lineWidth = R * 0.1; g.stroke();
      g.beginPath(); g.ellipse(R * 0.32, -R * 0.78, R * 0.25, R * 0.13, -0.4, 0, Math.PI * 2); g.fillStyle = '#3fae4f'; g.fill(); outline(R * 0.04);
      break;
    }
    case 5: { // strawberry
      g.beginPath();
      g.moveTo(0, R * 0.85);
      g.bezierCurveTo(-R * 0.95, R * 0.1, -R * 0.75, -R * 0.65, 0, -R * 0.5);
      g.bezierCurveTo(R * 0.75, -R * 0.65, R * 0.95, R * 0.1, 0, R * 0.85);
      g.fillStyle = '#ff3d5a'; g.fill(); outline();
      g.fillStyle = '#ffe58a';
      for (const [x, y] of [[-0.35, -0.15], [0, -0.2], [0.35, -0.15], [-0.2, 0.15], [0.2, 0.15], [0, 0.45], [-0.45, 0.12], [0.45, 0.12]]) {
        g.beginPath(); g.ellipse(x * R, y * R, R * 0.04, R * 0.065, 0, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = '#3fae4f';
      for (const a of [-1, -0.5, 0, 0.5, 1]) {
        g.save(); g.translate(0, -R * 0.55); g.rotate(a);
        g.beginPath(); g.ellipse(0, -R * 0.15, R * 0.09, R * 0.22, 0, 0, Math.PI * 2); g.fill();
        g.restore();
      }
      break;
    }
  }
  g.restore();
}

export function fruitDataURL(id, size = 96) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  drawFruit(c.getContext('2d'), id, size / 2, size / 2 + size * 0.02, size * 0.4);
  return c.toDataURL();
}
