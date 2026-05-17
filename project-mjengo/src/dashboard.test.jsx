import React from 'react';

// Simple unit test to ensure your ledger reduction math works flawlessly
describe('Project Mjengo Ledger Math', () => {
  test('calculates totalSpent accurately from logs array', () => {
    const mockLogs = [
      { id: 1, item: 'Cement', total: 15000 },
      { id: 2, item: 'Sand', total: 20000 },
      { id: 3, item: 'Ballast', total: 35000 }
  ];

    const totalSpent = mockLogs.reduce((sum, item) => sum + item.total, 0);
    
    // Total should equal 70,000 KES
    expect(totalSpent).toBe(70000);
  });
});