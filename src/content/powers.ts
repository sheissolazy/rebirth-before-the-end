import type { PowerDef } from '../engine/types'

export const powers: PowerDef[] = [
  { id: 'power_space', kind: 'space', name: { zh: '空间' }, desc: { zh: '女主的随身空间。里面的东西抢不走。' }, levels: [
    { rarity: 'common', desc: { zh: '6 格' }, upgradeCorePoints: 0 },
    { rarity: 'fine', desc: { zh: '30 格的小房间' }, upgradeCorePoints: 8 },
    { rarity: 'rare', desc: { zh: '100 格仓库，可放活物' }, upgradeCorePoints: 24 },
    { rarity: 'legendary', desc: { zh: '灵泉、时间 1:3（第一版不做）' }, upgradeCorePoints: 64 },
  ] },
  { id: 'power_lightning', kind: 'lightning', name: { zh: '雷电' }, desc: { zh: '顾沉。' }, levels: [
    { rarity: 'rare', desc: { zh: '尸潮 +4 分' }, upgradeCorePoints: 0 },
    { rarity: 'legendary', desc: { zh: '尸潮 +8 分' }, upgradeCorePoints: 64 },
  ] },
  { id: 'power_heal', kind: 'heal', name: { zh: '治愈' }, desc: { zh: '沈砚。' }, levels: [
    { rarity: 'rare', desc: { zh: '每周治一人' }, upgradeCorePoints: 0 },
    { rarity: 'legendary', desc: { zh: '可逆转初期感染' }, upgradeCorePoints: 64 },
  ] },
  { id: 'power_time', kind: 'time', name: { zh: '时间减速' }, desc: { zh: '谢临。' }, levels: [
    { rarity: 'legendary', desc: { zh: '任何检定 +3 骰' }, upgradeCorePoints: 0 },
  ] },
  { id: 'power_fire', kind: 'fire', name: { zh: '火' }, desc: { zh: '江野，第 2 年觉醒。' }, levels: [
    { rarity: 'fine', desc: { zh: '尸潮 +2 分' }, upgradeCorePoints: 0 },
    { rarity: 'rare', desc: { zh: '尸潮 +4 分' }, upgradeCorePoints: 24 },
  ] },
  { id: 'power_mind', kind: 'mind', name: { zh: '精神操控' }, desc: { zh: '阿寂。' }, levels: [
    { rarity: 'legendary', desc: { zh: '可解除一次尸潮' }, upgradeCorePoints: 0 },
  ] },
]
