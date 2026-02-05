import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product, size, quantity = 1) => {
        set((state) => {
          const existingItemIndex = state.items.findIndex(
            (item) => item.product._id === product._id && item.size === size
          );

          if (existingItemIndex > -1) {
            const newItems = [...state.items];
            newItems[existingItemIndex].quantity += quantity;
            return { items: newItems };
          }

          return {
            items: [
              ...state.items,
              {
                product,
                size,
                quantity,
                price: product.salePrice || product.price
              }
            ]
          };
        });
      },

      removeItem: (productId, size) => {
        set((state) => ({
          items: state.items.filter(
            (item) => !(item.product._id === productId && item.size === size)
          )
        }));
      },

      updateQuantity: (productId, size, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId, size);
          return;
        }

        set((state) => ({
          items: state.items.map((item) =>
            item.product._id === productId && item.size === size
              ? { ...item, quantity }
              : item
          )
        }));
      },

      clearCart: () => {
        set({ items: [] });
      },

      getCartTotal: () => {
        const items = get().items;
        return items.reduce((total, item) => total + item.price * item.quantity, 0);
      },

      getCartCount: () => {
        const items = get().items;
        return items.reduce((count, item) => count + item.quantity, 0);
      },

      getCartItems: () => {
        return get().items;
      }
    }),
    {
      name: 'puso-cart-storage',
      getStorage: () => localStorage
    }
  )
);

export default useCartStore;
