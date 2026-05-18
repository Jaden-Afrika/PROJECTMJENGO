jest.mock('react-router-dom'); // use manual mock in src/__mocks__/react-router-dom.js
jest.mock('./AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    user: null,
    loading: false,
    login: jest.fn(),
    logout: jest.fn()
  })
}));

import { render, screen } from '@testing-library/react';
import App from './App';

test('renders app header and sign-in', () => {
  render(<App />);
  expect(screen.getByText(/PROJECT MJENGO/i)).toBeInTheDocument();
  expect(screen.getByText(/Sign in with Google Account/i)).toBeInTheDocument();
});
