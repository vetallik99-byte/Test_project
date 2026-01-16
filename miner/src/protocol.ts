export const PROTOCOL = Object.freeze({
  OPCODES: Object.freeze({
    START: 0x01,
    OPEN_CELL: 0x02,
    CASH_OUT: 0x03,
    ADJUST_BET: 0x04,
  }),
  MSG: Object.freeze({
    STATE: 0x10,
    ERROR: 0x11,
  }),
});

export type Protocol = typeof PROTOCOL;
