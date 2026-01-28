export const PASS_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  checked_in: 'bg-blue-100 text-blue-800',
  checked_out: 'bg-gray-100 text-gray-800',
  expired: 'bg-red-100 text-red-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
}

export const DELIVERY_STATUS_COLORS: Record<string, string> = {
  expected: 'bg-yellow-100 text-yellow-800',
  arrived: 'bg-blue-100 text-blue-800',
  delivered: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
}

export const GATE_TYPES = [
  { value: 'pedestrian', label: 'Pedestrian' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'service', label: 'Service' },
]

export const DELIVERY_TYPES = [
  { value: 'food_order', label: 'Food Order' },
  { value: 'courier', label: 'Courier' },
  { value: 'document', label: 'Document' },
  { value: 'other', label: 'Other' },
]

export const FOOD_PLATFORMS = ['Swiggy', 'Zomato', 'Uber Eats', 'Dunzo']
