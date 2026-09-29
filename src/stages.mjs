// Four places, one level each, then around again faster. Every lane lists its objects' starting
// cells (at), their length in cells, its direction, its speed in units per tick (240 units = 1 cell,
// so 4 is one cell a second) and its loop: the lane's total length in cells, on screen and off.
// road: the five lanes from the sidewalk up; water: the five from the island up.
// dive: which objects sink now and then. buwaya: which object becomes a crocodile once they appear.
export const STAGES = [
  {
    n: 1, name: 'Cubao', road: 'EDSA', water: 'Estero', rain: 0.35, night: false, board: 'CUBAO',
    colors: { water: '#3f6b5c', road: '#34363f', island: '#8a8f86', walk: '#b9ad97' },
    lanes: {
      road: [
        { type: 'tricycle', dir: -1, speed: 3, len: 1, at: [0, 5, 10], loop: 16 },
        { type: 'jeep', dir: 1, speed: 3, len: 2, at: [0, 6, 12], loop: 18 },
        { type: 'taxi', dir: -1, speed: 5, len: 1, at: [0, 6, 11], loop: 17 },
        { type: 'motor', dir: 1, speed: 8, len: 1, at: [0], loop: 16 },
        { type: 'bus', dir: -1, speed: 3, len: 3, at: [0, 9], loop: 20 },
      ],
      water: [
        { type: 'pagong', dir: -1, speed: 3, len: 3, at: [0, 6, 12], loop: 18, dive: [2] },
        { type: 'troso', dir: 1, speed: 2, len: 3, at: [0, 6, 12], loop: 18 },
        { type: 'troso', dir: 1, speed: 5, len: 5, at: [0, 9], loop: 20, buwaya: 1 },
        { type: 'pagong', dir: -1, speed: 4, len: 2, at: [0, 4.5, 9, 13.5], loop: 18, dive: [1] },
        { type: 'balsa', dir: 1, speed: 3, len: 4, at: [0, 7, 14], loop: 21 },
      ],
    },
  },
  {
    n: 2, name: 'España', road: 'España Blvd', water: 'Baha', rain: 0.8, night: false, board: 'QUIAPO',
    colors: { water: '#6b5a3e', road: '#30323a', island: '#7f837a', walk: '#aca08a' },
    lanes: {
      road: [
        { type: 'pedicab', dir: -1, speed: 2.5, len: 1, at: [0, 4, 9, 13], loop: 17 },
        { type: 'jeep', dir: 1, speed: 4, len: 2, at: [0, 7, 13], loop: 19 },
        { type: 'truck', dir: -1, speed: 3, len: 2, at: [0, 8], loop: 18 },
        { type: 'taxi', dir: 1, speed: 7, len: 1, at: [0, 8], loop: 16 },
        { type: 'jeep', dir: -1, speed: 4.5, len: 2, at: [0, 6, 12], loop: 18 },
      ],
      water: [
        { type: 'salbabida', dir: -1, speed: 3.5, len: 3, at: [0, 6, 12], loop: 18, dive: [0, 2] },
        { type: 'batya', dir: 1, speed: 3, len: 2, at: [0, 5, 10, 15], loop: 20 },
        { type: 'banig', dir: 1, speed: 5, len: 5, at: [0, 10], loop: 20, buwaya: 1 },
        { type: 'styro', dir: -1, speed: 4.5, len: 2, at: [0, 4.5, 9, 13.5], loop: 18, dive: [2] },
        { type: 'banig', dir: 1, speed: 3.5, len: 4, at: [0, 7, 14], loop: 21 },
      ],
    },
  },
  {
    n: 3, name: 'Quiapo', road: 'Quezon Blvd', water: 'Ilog Pasig', rain: 0.5, night: false, board: 'BACLARAN',
    colors: { water: '#2f5f6b', road: '#33353d', island: '#858a82', walk: '#b3a891' },
    lanes: {
      road: [
        { type: 'kalesa', dir: -1, speed: 2, len: 2, at: [0, 7, 13], loop: 19 },
        { type: 'jeep', dir: 1, speed: 4.5, len: 2, at: [0, 6, 12], loop: 18 },
        { type: 'bus', dir: -1, speed: 3.5, len: 3, at: [0, 9], loop: 20 },
        { type: 'motor', dir: 1, speed: 9, len: 1, at: [0, 9], loop: 18 },
        { type: 'taxi', dir: -1, speed: 6, len: 1, at: [0, 5, 10], loop: 16 },
      ],
      water: [
        { type: 'lily', dir: -1, speed: 4, len: 3, at: [0, 6, 12], loop: 18, dive: [1, 2] },
        { type: 'bangka', dir: 1, speed: 3, len: 3, at: [0, 6, 12], loop: 18 },
        { type: 'ferry', dir: 1, speed: 5.5, len: 5, at: [0, 10], loop: 20, buwaya: 1 },
        { type: 'lily', dir: -1, speed: 5, len: 2, at: [0, 4.5, 9, 13.5], loop: 18, dive: [0, 2] },
        { type: 'bangka', dir: 1, speed: 4, len: 3, at: [0, 6, 12], loop: 18 },
      ],
    },
  },
  {
    n: 4, name: 'Maynila', road: 'Taft Avenue', water: 'Estero de Paco', rain: 1, night: true, board: 'MOA',
    colors: { water: '#24414a', road: '#23242c', island: '#5d6159', walk: '#7d7566' },
    lanes: {
      road: [
        { type: 'tricycle', dir: -1, speed: 4, len: 1, at: [0, 4, 8, 12], loop: 16 },
        { type: 'jeep', dir: 1, speed: 5, len: 2, at: [0, 6, 12], loop: 18 },
        { type: 'bus', dir: -1, speed: 4, len: 3, at: [0, 8, 15], loop: 22 },
        { type: 'motor', dir: 1, speed: 10, len: 1, at: [0, 6, 11], loop: 17 },
        { type: 'truck', dir: -1, speed: 5, len: 2, at: [0, 7, 13], loop: 19 },
      ],
      water: [
        { type: 'pagong', dir: -1, speed: 4.5, len: 3, at: [0, 6, 12], loop: 18, dive: [0, 1, 2] },
        { type: 'troso', dir: 1, speed: 3.5, len: 3, at: [0, 6, 12], loop: 18 },
        { type: 'troso', dir: 1, speed: 6, len: 5, at: [0, 10], loop: 20, buwaya: 1 },
        { type: 'pagong', dir: -1, speed: 5.5, len: 2, at: [0, 4.5, 9, 13.5], loop: 18, dive: [1, 3] },
        { type: 'balsa', dir: 1, speed: 4.5, len: 3, at: [0, 6, 12], loop: 18 },
      ],
    },
  },
];

// Manong Enforcer's tips, for the loading and game-over cards. The first is the one-time safety line.
export const TIPS = [
  'Si Kokak ay palaka, kaya siya lang ang tumatawid nang ganyan. Tayo, sa footbridge o sa pedestrian lane!',
  'Ang pagong, lumulubog paminsan-minsan. Huwag tumambay sa likod niya!',
  'Sa troso ka sumakay, hindi sa tubig. Kahit palaka ka, tatangayin ka ng agos.',
  'May lamok sa dahon? Sunggaban mo! +200.',
  'May buwaya sa estero! Sa katawan puwede, sa ulo hindi.',
  'May naliligaw na anak na palaka sa troso. Iuwi mo siya para sa bonus.',
  'Pag naubos ang oras, balik ka sa simula. Bilis-bilisan, Kokak!',
  'Pag baha, huwag lumusong, apo. May leptospirosis! Kung napalusong, magpatingin agad.',
  'Mas mabilis ang motor kaysa sa bus. Tingnan muna bago tumalon.',
  'Ang ahas sa gitna, pabalik-balik lang. Abangan ang pagdaan niya.',
  'Pag-uwi galing sa ulan, maghugas ng paa at magpalit ng damit.',
  'Hindi mo kailangang dumiretso. Minsan, maghintay muna sa isla.',
];
