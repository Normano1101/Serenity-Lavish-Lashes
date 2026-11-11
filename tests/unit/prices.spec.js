// Fast checks of the price rules shared by the admin editors and the public price list.
// No browser or database needed: these import the same code the website runs.
import { expect, test } from '@playwright/test';
import {
    formatServicePrice,
    MAX_SERVICE_PRICE,
    pairFullSetsWithFills,
    parseOptionalPrice
} from '../../src/data/services.js';

test.describe('Typed prices are checked before saving', () => {
    test('normal prices are accepted', () => {
        expect(parseOptionalPrice('105', 'Full set price')).toBe(105);
        expect(parseOptionalPrice('85.5', 'Full set price')).toBe(85.5);
        expect(parseOptionalPrice('85.50', 'Full set price')).toBe(85.5);
        expect(parseOptionalPrice('0', 'Full set price')).toBe(0);
        expect(parseOptionalPrice(75, 'Full set price')).toBe(75); // prices loaded from the database are numbers
    });

    test('a blank price means "Price TBD"', () => {
        expect(parseOptionalPrice('', 'Full set price')).toBeNull();
        expect(parseOptionalPrice('   ', 'Full set price')).toBeNull();
    });

    test('negative prices are refused', () => {
        expect(() => parseOptionalPrice('-1', 'Full set price')).toThrow('non-negative');
    });

    test('text that is not a number is refused', () => {
        expect(() => parseOptionalPrice('abc', 'Full set price')).toThrow('non-negative');
        expect(() => parseOptionalPrice('Infinity', 'Full set price')).toThrow('non-negative');
    });

    test('fractions of a cent are refused instead of silently rounded', () => {
        expect(() => parseOptionalPrice('10.555', 'Full set price')).toThrow('two decimal places');
        expect(() => parseOptionalPrice('1e2', 'Full set price')).toThrow('two decimal places');
    });

    test('a price with an extra digit is caught', () => {
        expect(parseOptionalPrice(String(MAX_SERVICE_PRICE), 'Full set price')).toBe(MAX_SERVICE_PRICE);
        expect(() => parseOptionalPrice('10500', 'Full set price')).toThrow('or less');
    });

    test('the message names the field that is wrong', () => {
        expect(() => parseOptionalPrice('-5', '3-week refill price')).toThrow(/^3-week refill price/);
    });
});

test.describe('The public price list shows saved prices correctly', () => {
    test('prices are formatted for customers', () => {
        expect(formatServicePrice(105)).toBe('$105');
        expect(formatServicePrice('105.00')).toBe('$105'); // the database returns numeric columns as text sometimes
        expect(formatServicePrice(10.5)).toBe('$10.50');
        expect(formatServicePrice(null)).toBe('Price TBD');
        expect(formatServicePrice(0)).toBe('$0');
    });

    test('each full set is shown with its own fill prices', () => {
        const pairs = pairFullSetsWithFills([
            { id: 'a', name: 'Classic Full Set', price: 105 },
            { id: 'b', name: 'Volume Fill', price: 90, refill_3_week_price: 95 },
            { id: 'c', name: 'Classic Fill', price: 75, refill_3_week_price: 85 },
            { id: 'd', name: 'Volume Full Set', price: 130 }
        ]);
        expect(pairs.map(({ full, fill }) => [full.price, fill.price, fill.refill_3_week_price])).toEqual([
            [105, 75, 85],
            [130, 90, 95]
        ]);
    });

    test('a full set without a fill row still appears', () => {
        const [pair] = pairFullSetsWithFills([{ id: 'a', name: 'New Style Full Set', price: 140 }]);
        expect(pair.full.price).toBe(140);
        expect(pair.fill).toBeUndefined();
    });
});
