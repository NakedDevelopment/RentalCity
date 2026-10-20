import assert from 'node:assert/strict'
import test from 'node:test'
import { isSameProperty, parseStreet, propertyConflict } from './propertyAddress'

const address = { addressLine1: '5022 Byron', city: 'Memphis', state: 'TN', postalCode: '38122' }
const record = { addressLine1: '5022 Byron Rd', city: 'Memphis', state: 'TN', zipCode: '38122' }

test('missing street types can be completed; abbreviations, case, and spacing are equivalent', () => {
  assert.equal(isSameProperty(address, record), true)
  assert.equal(isSameProperty({ ...address, addressLine1: ' 5022  BYRON Road. ' }, record), true)
  assert.equal(isSameProperty({ ...address, addressLine1: '5022 Byron Rd' }, { ...record, addressLine1: '5022 Byron' }), true)
  assert.equal(isSameProperty({ ...address, addressLine1: '1838 W 1690 N' },
    { ...record, addressLine1: '1838 West 1690 North' }), true)
})

test('inline units and separate unit lines are equivalent without losing post-directions', () => {
  for (const line of ['998 Fair St #1 SW', '998 Fair Street, Apt 1 SW', '998 Fair St SW, Unit #1']) {
    assert.equal(isSameProperty({ ...address, addressLine1: line }, { ...record, addressLine1: '998 Fair St SW', addressLine2: 'Apt 1' }), true)
  }
  assert.equal(isSameProperty({ ...address, addressLine1: '3247 Thirteen Colony Mall APT#3A' },
    { ...record, addressLine1: '3247 Thirteen Colony Mall', addressLine2: 'Unit 3A' }), true)
  assert.equal(parseStreet('123 Oak Street, Apt 4B').street, '123 Oak Street')
  assert.equal(parseStreet('998 Fair St #1 SW').post, 'sw')
  assert.equal(parseStreet('123 Aptos Ave').street, '123 Aptos Ave')
  assert.equal(parseStreet('123 Stevens Rd').street, '123 Stevens Rd')
  assert.equal(isSameProperty({ ...address, addressLine2: 'Apt 1' }, { ...record, addressLine2: 'Unit #1' }), true)
})

test('street numbers, explicit types, names, directions, states, and ZIP conflicts remain rejected', () => {
  const cases = [
    [{ ...record, addressLine1: '5023 Byron Rd' }, 'street_number_conflict'],
    [{ ...record, addressLine1: '5022 Bryan Rd' }, 'street_name_conflict'],
    [{ ...record, addressLine1: '5022 E Byron Rd' }, 'direction_conflict'],
    [{ ...record, addressLine1: '5022 Byron Rd SW' }, 'direction_conflict'],
    [{ ...record, state: 'MS' }, 'state_conflict'],
    [{ ...record, zipCode: '38123' }, 'zip_conflict'],
  ] as const
  for (const [candidate, reason] of cases) assert.equal(propertyConflict(address, candidate), reason)
  assert.equal(propertyConflict({ ...address, addressLine1: '5022 Byron Drive' }, record), 'street_type_conflict')
  assert.equal(isSameProperty({ ...address, addressLine1: '131-68 225th St' }, { ...record, addressLine1: '13168 225th St' }), false)
  assert.equal(isSameProperty({ ...address, addressLine1: '123 1/2 Main St' }, { ...record, addressLine1: '123 Main St' }), false)
  assert.equal(isSameProperty({ ...address, addressLine1: '314 Newcastle Dr', postalCode: '32548' },
    { ...record, addressLine1: '314 Newcastle Dr', zipCode: '32547' }), false)
})

test('conflicting units are rejected but building-level locations are allowed', () => {
  assert.equal(propertyConflict({ ...address, addressLine2: 'Apt 1' }, { ...record, addressLine2: 'Unit 2' }), 'unit_conflict')
  assert.equal(propertyConflict({ ...address, addressLine1: '5022 Byron Apt 1', addressLine2: 'Unit 2' }, record), 'unit_conflict')
  assert.equal(propertyConflict(address, { ...record, addressLine1: '5022 Byron Rd Apt 1', addressLine2: 'Unit 2' }), 'unit_conflict')
  assert.equal(isSameProperty({ ...address, addressLine2: 'Unit 2' }, record), true)
  assert.equal(isSameProperty({ ...address, addressLine1: '' }, record), false)
})
