import { describe, expect, it } from 'vitest'
import {
  normalizeProfileNicknames,
  splitNameAndNickname,
} from './personName'

describe('splitNameAndNickname', () => {
  it('extracts a parenthetical nickname', () => {
    expect(splitNameAndNickname('Anna Elisabeth (Anna-lisa) Davidsson')).toEqual({
      name: 'Anna Elisabeth Davidsson',
      nickname: 'Anna-lisa',
    })
  })

  it('leaves plain names alone', () => {
    expect(splitNameAndNickname('Per Olof Davidsson')).toEqual({
      name: 'Per Olof Davidsson',
    })
  })
})

describe('normalizeProfileNicknames', () => {
  it('moves embedded nicknames into the nickname field', () => {
    const profiles = {
      a: {
        id: 'a',
        name: 'Anna Elisabeth (Anna-lisa) Davidsson',
        gender: 'female' as const,
      },
    }
    const next = normalizeProfileNicknames(profiles)
    expect(next.a).toEqual({
      id: 'a',
      name: 'Anna Elisabeth Davidsson',
      nickname: 'Anna-lisa',
      gender: 'female',
    })
  })

  it('does not overwrite an existing nickname', () => {
    const profiles = {
      a: {
        id: 'a',
        name: 'Anna (Lisa) Davidsson',
        nickname: 'Anna-lisa',
        gender: 'female' as const,
      },
    }
    expect(normalizeProfileNicknames(profiles)).toBe(profiles)
  })
})
