import { create } from 'zustand';

interface CreateTeamModalStore {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const useStore = create<CreateTeamModalStore>((set) => ({
  isOpen: false,
  setIsOpen: (open) => set({ isOpen: open }),
}));

export const useCreateTeamModal = () => {
  const { isOpen, setIsOpen } = useStore();
  return [isOpen, setIsOpen] as const;
}; 