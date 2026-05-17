import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Dashboard from './Dashboard';

const mockAddDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockSetDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockOnSnapshot = jest.fn();
const mockUploadBytes = jest.fn();
const mockGetDownloadURL = jest.fn();

jest.mock('./AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'user-1', displayName: 'Jaden Afrika' },
    logout: jest.fn()
  })
}));

jest.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
  useParams: () => ({ projectId: 'project-1' })
}));

jest.mock('./firebase', () => ({
  db: {},
  storage: {}
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((db, name) => ({ db, name })),
  addDoc: (...args) => mockAddDoc(...args),
  deleteDoc: (...args) => mockDeleteDoc(...args),
  setDoc: (...args) => mockSetDoc(...args),
  doc: jest.fn((db, name, id) => ({ db, name, id })),
  getDoc: (...args) => mockGetDoc(...args),
  onSnapshot: (...args) => mockOnSnapshot(...args),
  query: jest.fn((collectionRef, ...filters) => ({ collectionRef, filters })),
  where: jest.fn((field, operator, value) => ({ field, operator, value }))
}));

jest.mock('firebase/storage', () => ({
  ref: jest.fn((storage, path) => ({ storage, path })),
  uploadBytes: (...args) => mockUploadBytes(...args),
  getDownloadURL: (...args) => mockGetDownloadURL(...args)
}));

const makeSnapshot = (items) => ({
  docs: items.map((item) => ({
    id: item.id,
    data: () => item
  }))
});

beforeEach(() => {
  jest.clearAllMocks();
  let snapshotCall = 0;

  mockGetDoc.mockResolvedValue({
    id: 'project-1',
    exists: () => true,
    data: () => ({
      userId: 'user-1',
      name: 'Kilimani Build',
      location: 'Nairobi',
      type: 'Residential Build',
      budget: 100000
    })
  });

  mockOnSnapshot.mockImplementation((queryRef, callback) => {
    snapshotCall += 1;

    if (snapshotCall === 1) {
      callback(makeSnapshot([
        {
          id: 'log-1',
          itemName: 'Cement',
          quantity: 10,
          price: 800,
          total: 8000,
          type: 'material',
          createdAt: '2026-05-05T00:00:00.000Z'
        },
        {
          id: 'log-2',
          itemName: 'Mason',
          quantity: 2,
          price: 1500,
          total: 3000,
          type: 'labor',
          createdAt: '2026-05-04T00:00:00.000Z'
        }
      ]));
    }

    if (snapshotCall === 2) {
      callback(makeSnapshot([
        {
          id: 'photo-1',
          imageUrl: 'https://example.com/site.jpg',
          caption: 'Foundation complete',
          createdAt: '2026-05-06T00:00:00.000Z'
        }
      ]));
    }

    if (snapshotCall === 3) {
      callback(makeSnapshot([
        {
          id: 'market-sand',
          materialName: 'Sand',
          unit: 'lorry',
          averagePrice: 12000,
          source: 'Local supplier',
          createdAt: '2026-05-02T00:00:00.000Z'
        }
      ]));
    }

    return jest.fn();
  });

  mockAddDoc.mockResolvedValue({ id: 'created-doc' });
  mockSetDoc.mockResolvedValue();
  mockDeleteDoc.mockResolvedValue();
  mockUploadBytes.mockResolvedValue();
  mockGetDownloadURL.mockResolvedValue('https://example.com/uploaded.jpg');
});

describe('Dashboard', () => {
  test('renders project metrics, ledger entries, market prices, and progress photos', async () => {
    render(<Dashboard />);

    expect(await screen.findByText(/Kilimani Build/i)).toBeInTheDocument();
    expect(screen.getByText(/Nairobi/i)).toBeInTheDocument();
    expect(screen.getByText(/KES 100,000/i)).toBeInTheDocument();
    expect(screen.getByText(/KES 11,000/i)).toBeInTheDocument();
    expect(screen.getByText(/KES 89,000/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Cement/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Mason/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Sand/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Local supplier/i)).toBeInTheDocument();
    expect(screen.getByText(/Foundation complete/i)).toBeInTheDocument();
  });

  test('filters ledger rows with search', async () => {
    render(<Dashboard />);

    expect(await screen.findByText(/Kilimani Build/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Cement/i).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText(/Search previous entries/i), {
      target: { value: 'Mason' }
    });

    expect(screen.queryByText(/KES 8,000/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Mason/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Search previous entries/i), {
      target: { value: 'Transport' }
    });

    expect(screen.getByText(/No entries match your search/i)).toBeInTheDocument();
  });

  test('shows material market comparison and saves a ledger entry', async () => {
    const { container } = render(<Dashboard />);

    expect(await screen.findByText(/Kilimani Build/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Bags of Bamburi Cement/i), {
      target: { value: 'Cement' }
    });
    const amountInputs = screen.getAllByPlaceholderText('0');
    fireEvent.change(amountInputs[0], {
      target: { value: '3' }
    });
    fireEvent.change(amountInputs[1], {
      target: { value: '800' }
    });

    expect(screen.getByText(/Market Average/i)).toBeInTheDocument();
    expect(screen.getByText(/50 KES above/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Save to Digital Ledger/i }));

    await waitFor(() => {
      expect(mockAddDoc).toHaveBeenCalled();
      expect(mockAddDoc.mock.calls[0][1]).toEqual(expect.objectContaining({
        userId: 'user-1',
        projectId: 'project-1',
        projectName: 'Kilimani Build',
        itemName: 'Cement',
        quantity: 3,
        price: 800,
        total: 2400,
        type: 'material'
      }));
    });
  });

  test('validates and saves market prices', async () => {
    render(<Dashboard />);

    expect(await screen.findByText(/Average Market Prices/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Save Price/i }));
    expect(screen.getByText(/Add the material, unit, and average price/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Material/i), {
      target: { value: 'Timber' }
    });
    fireEvent.change(screen.getByPlaceholderText(/Unit/i), {
      target: { value: 'piece' }
    });
    fireEvent.change(screen.getByPlaceholderText(/Avg KES/i), {
      target: { value: '550' }
    });
    fireEvent.change(screen.getByPlaceholderText(/Source/i), {
      target: { value: 'Yard quote' }
    });

    fireEvent.click(screen.getByRole('button', { name: /Save Price/i }));

    await waitFor(() => {
      expect(mockSetDoc).toHaveBeenCalled();
      expect(mockSetDoc.mock.calls[0][1]).toEqual(expect.objectContaining({
        userId: 'user-1',
        materialName: 'Timber',
        unit: 'piece',
        averagePrice: 550,
        source: 'Yard quote'
      }));
    });
  });

  test('uploads a progress photo after validation', async () => {
    const { container } = render(<Dashboard />);

    expect(await screen.findByText(/Kilimani Build/i)).toBeInTheDocument();
    expect(screen.getByText(/Progress Photo Bay/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Add Progress Photo/i }));
    expect(screen.getByText(/Please choose a progress image/i)).toBeInTheDocument();

    const file = new File(['image-data'], 'site photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(container.querySelector('input[type="file"]'), {
      target: { files: [file] }
    });
    fireEvent.change(screen.getByPlaceholderText(/Caption, phase, or site note/i), {
      target: { value: 'Roofing started' }
    });

    fireEvent.click(screen.getByRole('button', { name: /Add Progress Photo/i }));

    await waitFor(() => {
      expect(mockUploadBytes).toHaveBeenCalled();
      expect(mockAddDoc).toHaveBeenCalled();
      expect(mockAddDoc.mock.calls[0][1]).toEqual(expect.objectContaining({
        userId: 'user-1',
        projectId: 'project-1',
        projectName: 'Kilimani Build',
        imageUrl: 'https://example.com/uploaded.jpg',
        caption: 'Roofing started',
        fileName: 'site photo.jpg'
      }));
    });
  });
});
