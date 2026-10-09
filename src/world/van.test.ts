import { describe, expect, it } from 'vitest'
import { driveStep, vanPose, vehicleBlocker, DRIVE, type DriveState } from './van'
import { GATE, PARADISE_EXTRAS, VAN_PARK } from './layout'

const free = () => false

describe('自己开面包车', () => {
  it('踩油门往前走、松开慢慢停；按 S 先刹车再倒车；最高速有上限', () => {
    let s: DriveState = { x: 0, z: 0, rot: 0, speed: 0 }
    for (let i = 0; i < 100; i++) s = driveStep(s, 1, 0, 0.05, free)
    expect(s.speed).toBeCloseTo(DRIVE.maxF)
    expect(s.z).toBeGreaterThan(10) // 朝 +z 开
    for (let i = 0; i < 60; i++) s = driveStep(s, 0, 0, 0.05, free)
    expect(s.speed).toBeLessThan(DRIVE.maxF)
    for (let i = 0; i < 100; i++) s = driveStep(s, -1, 0, 0.05, free)
    expect(s.speed).toBeCloseTo(-DRIVE.maxR)
  })

  it('往前开时按 A 车头往左转（rot 变大），倒车时方向反过来', () => {
    let s: DriveState = { x: 0, z: 0, rot: 0, speed: 3 }
    s = driveStep(s, 1, 1, 0.1, free)
    expect(s.rot).toBeGreaterThan(0)
    let r: DriveState = { x: 0, z: 0, rot: 0, speed: -2 }
    r = driveStep(r, -1, 1, 0.1, free)
    expect(r.rot).toBeLessThan(0)
  })

  it('正面撞墙就停在墙前；斜着蹭墙会顺着墙滑过去', () => {
    const wall = (_x: number, z: number) => z > 3
    let s: DriveState = { x: 0, z: 0, rot: 0, speed: 0 }
    for (let i = 0; i < 100; i++) s = driveStep(s, 1, 0, 0.05, wall)
    expect(s.z).toBeLessThan(1.2)
    expect(s.speed).toBeLessThan(1)
    // 斜着 45 度开向墙：撞上以后沿着墙往 +x 走
    let t: DriveState = { x: 0, z: 0, rot: Math.PI / 4, speed: 0 }
    for (let i = 0; i < 100; i++) t = driveStep(t, 1, 0, 0.05, wall)
    expect(t.z).toBeLessThan(1.4) // 斜着时车角先碰墙，车身中心停在 1.27 左右
    expect(t.x).toBeGreaterThan(2)
  })

  it('开车出门：能从车位开出来、在院子里掉头、对准铁门开到街上', () => {
    const blocked = vehicleBlocker(PARADISE_EXTRAS)
    const drive = (s0: DriveState, throttle: number, steer: number, secs: number) => {
      let s = s0
      for (let t = 0; t < secs; t += 0.05) s = driveStep(s, throttle, steer, 0.05, blocked)
      return s
    }
    // ① 从车位往前开（往东）：开得出来，不会一起步就撞
    const out = drive({ x: VAN_PARK.x, z: VAN_PARK.z, rot: VAN_PARK.rot, speed: 0 }, 1, 0, 1.2)
    expect(out.x).toBeGreaterThan(VAN_PARK.x + 2)
    // ② 房子南边的空地上往右打满：能掉个头（转弯半径小，不撞房子、长椅、围栏）
    let turn: DriveState = { x: 3.2, z: 7.6, rot: Math.PI / 2, speed: 1.5 }
    let angle = 0
    for (let t = 0; t < 4 && Math.abs(angle) < Math.PI; t += 0.05) {
      const n = driveStep(turn, 0.15, -1, 0.05, blocked)
      angle += n.rot - turn.rot
      turn = n
    }
    expect(Math.abs(angle)).toBeGreaterThanOrEqual(Math.PI)
    // ③ 在铁门正北面、车头朝南：一路开出铁门到街上
    const gate = drive({ x: GATE.x, z: 10.2, rot: 0, speed: 0 }, 1, 0, 1.6)
    expect(gate.z).toBeGreaterThan(15)
  })

  it('掉帧时（一帧很长）也穿不过 16 厘米的细围栏；侧面蹭过细杆子也挡得住', () => {
    const fence = (_x: number, z: number) => z > 3 && z < 3.16
    let s: DriveState = { x: 0, z: 0, rot: 0, speed: DRIVE.maxF }
    for (let i = 0; i < 40; i++) s = driveStep(s, 1, 0, 0.15, fence)
    expect(s.z).toBeLessThan(3)
    // 一根细杆子在车身侧面（不在四个角上）：车平移过去会被挡住
    const pole = (x: number, z: number) => Math.hypot(x - 0.62, z - 0) < 0.08
    let t: DriveState = { x: 0, z: -3, rot: 0, speed: 3 }
    for (let i = 0; i < 40; i++) t = driveStep(t, 1, 0, 0.05, pole)
    expect(t.z).toBeLessThan(-1.2)
  })

  it('停在别处时，车就画在停的地方', () => {
    const p = vanPose(null, false, 0, { x: 10, z: 18, rot: 1 })
    expect([p.x, p.z, p.rot, p.visible]).toEqual([10, 18, 1, true])
  })
})
