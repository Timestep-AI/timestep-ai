import { ModernLayout } from '@/components/ModernLayout';

export const Tools = () => {
  return (
    <ModernLayout>
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">🔧</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Tools Coming Soon
        </h3>
        <p className="text-gray-600">
          Tool management features will be available in the next update.
        </p>
      </div>
    </ModernLayout>
  );
};

export default Tools;