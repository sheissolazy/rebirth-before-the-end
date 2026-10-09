// 在页面控制台（或 javascript_tool）里粘贴：需要 ?debug（window.__world）和 tools/preview/devserve.py 起的服务器。
// __ff(秒)：不渲染到屏幕地快进游戏；__shot(名字, [相机位置], [看向], 视角, 宽度)：离屏渲染一帧存成 <shots>/<名字>.jpg
const w = window.__world
window.__ff = (secs) => {
  const g = w.clock.getDelta.bind(w.clock)
  w.clock.getDelta = () => 0.05
  for (let i = 0; i < secs / 0.05; i++) { w.loop(); cancelAnimationFrame(w.raf) }
  w.clock.getDelta = g
  w.raf = requestAnimationFrame(w.loop)
}
window.__shot = async (name, pos, look, fov = 30, width = 900) => {
  const cam = w.camera.clone()
  const src = w.renderer.domElement
  cam.aspect = src.width / src.height
  if (pos) { cam.fov = fov; cam.position.set(...pos); cam.lookAt(...look) }
  cam.updateProjectionMatrix()
  cancelAnimationFrame(w.raf)
  w.renderer.render(w.scene, cam)
  // 必须在同一个任务里马上拷走（WebGL 画布下一帧就清空了）
  const c = document.createElement('canvas')
  c.width = width
  c.height = Math.round(width * src.height / src.width)
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height)
  const url = c.toDataURL('image/jpeg', 0.85)
  w.raf = requestAnimationFrame(w.loop)
  const r = await fetch('/__shot?name=' + name, { method: 'POST', body: url })
  return r.status
}
