'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/common/page-header';
import { ServicesPanel } from './services-panel';
import { CategoriesPanel } from './categories-panel';

export function ServicesClient() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Xizmatlar"
        description="Xizmatlar, narxlar va kategoriyalarni boshqarish."
      />
      <Tabs defaultValue="services">
        <TabsList>
          <TabsTrigger value="services">Xizmatlar</TabsTrigger>
          <TabsTrigger value="categories">Kategoriyalar</TabsTrigger>
        </TabsList>
        <TabsContent value="services">
          <ServicesPanel />
        </TabsContent>
        <TabsContent value="categories">
          <CategoriesPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
