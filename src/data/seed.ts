import type { Gender, Node, RelType } from 'relatives-tree/lib/types'
import type { FamilyStore, PersonProfile } from '../types'

const male = 'male' as Gender
const female = 'female' as Gender
const blood = 'blood' as RelType
const married = 'married' as RelType

const profiles: Record<string, PersonProfile> = {
  orjan: {
    id: 'orjan',
    name: 'Örjan Davidsson',
    birthYear: '1945',
    gender: 'male',
  },
  inger: {
    id: 'inger',
    name: 'Inger Davidsson',
    birthYear: '1942',
    gender: 'female',
  },
  camilla: {
    id: 'camilla',
    name: 'Camilla Davidsson',
    birthYear: '1968',
    gender: 'female',
  },
  peter: {
    id: 'peter',
    name: 'Peter Bergman',
    birthYear: '1962',
    gender: 'male',
  },
  mikael: {
    id: 'mikael',
    name: 'Mikael Davidsson',
    birthYear: '1971',
    gender: 'male',
  },
  annsofie: {
    id: 'annsofie',
    name: 'Ann-sofie Davidsson',
    birthYear: '1971',
    gender: 'female',
  },
  david: {
    id: 'david',
    name: 'David Bergman',
    birthYear: '1998',
    gender: 'male',
  },
  julia: {
    id: 'julia',
    name: 'Julia',
    birthYear: '1998',
    gender: 'female',
  },
  sara: {
    id: 'sara',
    name: 'Sara Bergman',
    birthYear: '2000',
    gender: 'female',
  },
  orvar: {
    id: 'orvar',
    name: 'Orvar Mörk',
    birthYear: '1998',
    gender: 'male',
  },
  sofia: {
    id: 'sofia',
    name: 'Sofia Davidsson',
    birthYear: '1998',
    occupation: 'Socionom',
    gender: 'female',
  },
  marcus: {
    id: 'marcus',
    name: 'Marcus Öhmer',
    birthYear: '1998',
    gender: 'male',
  },
  karin: {
    id: 'karin',
    name: 'Karin Davidsson',
    birthYear: '2005',
    occupation: 'Studerar',
    gender: 'female',
  },
  erik: {
    id: 'erik',
    name: 'Erik Davidsson',
    birthYear: '2000',
    occupation: 'Flygplanstekniker',
    gender: 'male',
  },
  folke: {
    id: 'folke',
    name: 'Folke Mörk',
    birthYear: '',
    gender: 'male',
  },
}

const nodes: Node[] = [
  {
    id: 'orjan',
    gender: male,
    parents: [],
    siblings: [],
    spouses: [{ id: 'inger', type: married }],
    children: [
      { id: 'camilla', type: blood },
      { id: 'mikael', type: blood },
    ],
  },
  {
    id: 'inger',
    gender: female,
    parents: [],
    siblings: [],
    spouses: [{ id: 'orjan', type: married }],
    children: [
      { id: 'camilla', type: blood },
      { id: 'mikael', type: blood },
    ],
  },
  {
    id: 'camilla',
    gender: female,
    parents: [
      { id: 'orjan', type: blood },
      { id: 'inger', type: blood },
    ],
    siblings: [{ id: 'mikael', type: blood }],
    spouses: [{ id: 'peter', type: married }],
    children: [
      { id: 'david', type: blood },
      { id: 'sara', type: blood },
    ],
  },
  {
    id: 'peter',
    gender: male,
    parents: [],
    siblings: [],
    spouses: [{ id: 'camilla', type: married }],
    children: [
      { id: 'david', type: blood },
      { id: 'sara', type: blood },
    ],
  },
  {
    id: 'mikael',
    gender: male,
    parents: [
      { id: 'orjan', type: blood },
      { id: 'inger', type: blood },
    ],
    siblings: [{ id: 'camilla', type: blood }],
    spouses: [{ id: 'annsofie', type: married }],
    children: [
      { id: 'sofia', type: blood },
      { id: 'karin', type: blood },
      { id: 'erik', type: blood },
    ],
  },
  {
    id: 'annsofie',
    gender: female,
    parents: [],
    siblings: [],
    spouses: [{ id: 'mikael', type: married }],
    children: [
      { id: 'sofia', type: blood },
      { id: 'karin', type: blood },
      { id: 'erik', type: blood },
    ],
  },
  {
    id: 'david',
    gender: male,
    parents: [
      { id: 'camilla', type: blood },
      { id: 'peter', type: blood },
    ],
    siblings: [{ id: 'sara', type: blood }],
    spouses: [{ id: 'julia', type: married }],
    children: [],
  },
  {
    id: 'julia',
    gender: female,
    parents: [],
    siblings: [],
    spouses: [{ id: 'david', type: married }],
    children: [],
  },
  {
    id: 'sara',
    gender: female,
    parents: [
      { id: 'camilla', type: blood },
      { id: 'peter', type: blood },
    ],
    siblings: [{ id: 'david', type: blood }],
    spouses: [{ id: 'orvar', type: married }],
    children: [{ id: 'folke', type: blood }],
  },
  {
    id: 'orvar',
    gender: male,
    parents: [],
    siblings: [],
    spouses: [{ id: 'sara', type: married }],
    children: [{ id: 'folke', type: blood }],
  },
  {
    id: 'sofia',
    gender: female,
    parents: [
      { id: 'mikael', type: blood },
      { id: 'annsofie', type: blood },
    ],
    siblings: [
      { id: 'karin', type: blood },
      { id: 'erik', type: blood },
    ],
    spouses: [{ id: 'marcus', type: married }],
    children: [],
  },
  {
    id: 'marcus',
    gender: male,
    parents: [],
    siblings: [],
    spouses: [{ id: 'sofia', type: married }],
    children: [],
  },
  {
    id: 'karin',
    gender: female,
    parents: [
      { id: 'mikael', type: blood },
      { id: 'annsofie', type: blood },
    ],
    siblings: [
      { id: 'sofia', type: blood },
      { id: 'erik', type: blood },
    ],
    spouses: [],
    children: [],
  },
  {
    id: 'erik',
    gender: male,
    parents: [
      { id: 'mikael', type: blood },
      { id: 'annsofie', type: blood },
    ],
    siblings: [
      { id: 'sofia', type: blood },
      { id: 'karin', type: blood },
    ],
    spouses: [],
    children: [],
  },
  {
    id: 'folke',
    gender: male,
    parents: [
      { id: 'sara', type: blood },
      { id: 'orvar', type: blood },
    ],
    siblings: [],
    spouses: [],
    children: [],
  },
]

export const SEED_FAMILY: FamilyStore = {
  rootId: 'sofia',
  profiles,
  nodes,
}
