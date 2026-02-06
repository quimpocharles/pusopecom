import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const matchItem = (item, productId, size, color) =>
  item.product._id === productId &&
  item.size === size &&
  (item.color || null) === (color || null);

const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product, size, quantity = 1, color = null) => {
        set((state) => {
          const existingItemIndex = state.items.findIndex(
            (item) => matchItem(item, product._id, size, color)
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
                color,
                quantity,
                price: product.salePrice || product.price
              }
            ]
          };
        });
      },

      removeItem: (productId, size, color = null) => {
        set((state) => ({
          items: state.items.filter(
            (item) => !matchItem(item, productId, size, color)
          )
        }));
      },

      updateQuantity: (productId, size, color = null, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId, size, color);
          return;
        }

        set((state) => ({
          items: state.items.map((item) =>
            matchItem(item, productId, size, color)
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
