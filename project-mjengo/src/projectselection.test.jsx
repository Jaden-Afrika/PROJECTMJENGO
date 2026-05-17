import React from 'react';
import { render, screen } from '@testing-library/react';
import ProjectSelection from './projectselection';

// Mock the AuthContext so the test doesn't crash on Google user data fetching
jest.mock('./AuthContext', () => ({
  useAuth: () => ({
    user: { displayName: 'Jaden Afrika' },
    logout: jest.fn()
  })
}));

describe('ProjectSelection Component Layout', () => {
  test('renders the workspace selection titles properly', () => {
    render(<ProjectSelection onSelectProject={jest.fn()} />);
    
    // Checks if the main headers are visible on screen
    expect(screen.getByText(/Project Mjengo/i)).toBeInTheDocument();
    expect(screen.getByText(/Create New Project/i)).toBeInTheDocument();
    expect(screen.getByText(/Ongoing Projects/i)).toBeInTheDocument();
  });
});