import { IonicLayout } from '@/components/IonicLayout';
import { IonIcon } from '@ionic/react';
import { chatbubbles } from 'ionicons/icons';

export const Chats = () => {
  return (
    <IonicLayout title="Chats">
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-surface-elevated rounded-full flex items-center justify-center mx-auto mb-4">
          <IonIcon icon={chatbubbles} className="text-4xl text-text-tertiary" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-2">
          Chats Coming Soon
        </h3>
        <p className="text-text-secondary">
          Chat management features will be available in the next update.
        </p>
      </div>
    </IonicLayout>
  );
};

export default Chats;