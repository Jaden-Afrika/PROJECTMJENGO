jest.mock('react-router-dom'); // use manual mock in src/__mocks__/react-router-dom.js
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders app header and sign-in', () => {
  render(<App />);
  expect(screen.getByText(/PROJECT MJENGO/i)).toBeInTheDocument();
  expect(screen.getByText(/Sign in with Google Account/i)).toBeInTheDocument();
});

