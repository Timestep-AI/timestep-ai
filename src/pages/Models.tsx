import { IonicLayout } from '@/components/IonicLayout';
import { IonIcon } from '@ionic/react';
import { desktop } from 'ionicons/icons';

export const Models = () => {
  return (
    <IonicLayout title="Models">
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-surface-elevated rounded-full flex items-center justify-center mx-auto mb-4">
          <IonIcon icon={desktop} className="text-4xl text-text-tertiary" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-2">
          Models Coming Soon
        </h3>
        <p className="text-text-secondary">
          AI model management features will be available in the next update.
        </p>
      </div>
    </IonicLayout>
  );
};

export default Models;