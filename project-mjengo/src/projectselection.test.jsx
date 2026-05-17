import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProjectSelection from './projectselection';

const mockAddDoc = jest.fn();
const mockOnSnapshot = jest.fn();
let mockProjectDocs = [];

jest.mock('./AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'user-1', displayName: 'Jaden Afrika' },
    logout: jest.fn()
  })
}));

jest.mock('./firebase', () => ({
  db: {}
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((db, name) => ({ db, name })),
  query: jest.fn((collectionRef, ...filters) => ({ collectionRef, filters })),
  where: jest.fn((field, operator, value) => ({ field, operator, value })),
  onSnapshot: (...args) => mockOnSnapshot(...args),
  addDoc: (...args) => mockAddDoc(...args)
}));

beforeEach(() => {
  mockAddDoc.mockResolvedValue({ id: 'new-project-id' });
  mockProjectDocs = [];
  mockOnSnapshot.mockImplementation((queryRef, callback) => {
    callback({
      docs: mockProjectDocs.map((project) => ({
        id: project.id,
        data: () => project
      }))
    });

    return jest.fn();
  });
});

describe('ProjectSelection Component Layout', () => {
  test('renders the workspace selection titles properly', () => {
    render(<ProjectSelection onSelectProject={jest.fn()} />);
    
    // Checks if the main headers are visible on screen
    expect(screen.getByText(/Project Mjengo/i)).toBeInTheDocument();
    expect(screen.getByText(/Create New Project/i)).toBeInTheDocument();
    expect(screen.getByText(/Ongoing Projects/i)).toBeInTheDocument();
  });

  test('shows projects from Firestore and opens the selected project', async () => {
    const onSelectProject = jest.fn();
    mockProjectDocs = [
      {
        id: 'project-1',
        name: 'Kilimani Build',
        budget: 2500000,
        location: 'Nairobi',
        manager: 'Jaden',
        type: 'Residential Build',
        createdAt: '2026-05-01T00:00:00.000Z'
      }
    ];

    render(<ProjectSelection onSelectProject={onSelectProject} />);

    const projectButton = await screen.findByRole('button', { name: /Kilimani Build/i });
    expect(screen.getByText(/Budget: KES 2,500,000/i)).toBeInTheDocument();
    expect(screen.getByText(/Location: Nairobi/i)).toBeInTheDocument();

    fireEvent.click(projectButton);

    expect(onSelectProject).toHaveBeenCalledWith(expect.objectContaining({
      id: 'project-1',
      name: 'Kilimani Build'
    }));
  });

  test('validates and creates a new project', async () => {
    const onSelectProject = jest.fn();

    render(<ProjectSelection onSelectProject={onSelectProject} />);

    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }));
    fireEvent.click(screen.getByRole('button', { name: /Start Working/i }));

    expect(screen.getByText(/Please add the project name/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Kilimani Three-Bedroom House/i), {
      target: { value: 'Rongai Maisonette' }
    });
    fireEvent.change(screen.getByPlaceholderText('2500000'), {
      target: { value: '3200000' }
    });
    fireEvent.change(screen.getByPlaceholderText(/Nairobi, Kenya/i), {
      target: { value: 'Rongai' }
    });
    fireEvent.change(screen.getByPlaceholderText(/Site manager name/i), {
      target: { value: 'Jaden' }
    });
    fireEvent.change(screen.getByPlaceholderText(/Key suppliers/i), {
      target: { value: 'Foundation phase' }
    });

    fireEvent.click(screen.getByRole('button', { name: /Start Working/i }));

    await waitFor(() => {
      expect(mockAddDoc).toHaveBeenCalled();
      expect(mockAddDoc.mock.calls[0][1]).toEqual(expect.objectContaining({
        userId: 'user-1',
        name: 'Rongai Maisonette',
        budget: 3200000,
        location: 'Rongai',
        manager: 'Jaden',
        notes: 'Foundation phase'
      }));
    });

    expect(onSelectProject).toHaveBeenCalledWith(expect.objectContaining({
      id: 'new-project-id',
      name: 'Rongai Maisonette'
    }));
  });
});
