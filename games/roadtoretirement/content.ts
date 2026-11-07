// Careers and houses; every name and number here is original to this game
export type Career = { id: string; name: string; salary: number; degree: boolean };
export type House = { id: string; name: string; price: number; saleValue: number };

export const CAREERS: readonly Career[] = [
  { id: 'surgeon', name: 'Surgeon', salary: 100000, degree: true },
  { id: 'lawyer', name: 'Lawyer', salary: 90000, degree: true },
  { id: 'engineer', name: 'Engineer', salary: 80000, degree: true },
  { id: 'pharmacist', name: 'Pharmacist', salary: 75000, degree: true },
  { id: 'architect', name: 'Architect', salary: 70000, degree: true },
  { id: 'accountant', name: 'Accountant', salary: 65000, degree: true },
  { id: 'teacher', name: 'Teacher', salary: 60000, degree: true },
  { id: 'nurse', name: 'Nurse', salary: 55000, degree: true },
  { id: 'electrician', name: 'Electrician', salary: 50000, degree: false },
  { id: 'plumber', name: 'Plumber', salary: 45000, degree: false },
  { id: 'carpenter', name: 'Carpenter', salary: 40000, degree: false },
  { id: 'chef', name: 'Chef', salary: 35000, degree: false },
  { id: 'mechanic', name: 'Mechanic', salary: 30000, degree: false },
  { id: 'driver', name: 'Truck Driver', salary: 28000, degree: false },
  { id: 'barber', name: 'Barber', salary: 25000, degree: false },
  { id: 'cashier', name: 'Cashier', salary: 20000, degree: false }
];

export const HOUSES: readonly House[] = [
  { id: 'cabin', name: 'Lake Cabin', price: 40000, saleValue: 50000 },
  { id: 'cottage', name: 'Garden Cottage', price: 60000, saleValue: 70000 },
  { id: 'bungalow', name: 'Corner Bungalow', price: 80000, saleValue: 90000 },
  { id: 'townhouse', name: 'City Townhouse', price: 100000, saleValue: 120000 },
  { id: 'ranch', name: 'Prairie Ranch', price: 120000, saleValue: 140000 },
  { id: 'farmhouse', name: 'Orchard Farmhouse', price: 150000, saleValue: 170000 },
  { id: 'colonial', name: 'Hilltop Colonial', price: 200000, saleValue: 230000 },
  { id: 'villa', name: 'Seaside Villa', price: 300000, saleValue: 350000 }
];

export const careerOf = (id: string): Career | undefined => CAREERS.find(c => c.id === id);
export const houseOf = (id: string): House | undefined => HOUSES.find(h => h.id === id);
