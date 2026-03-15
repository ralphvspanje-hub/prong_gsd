import { Layout } from "@/components/Layout";
import { Zap } from "lucide-react";

const Dashboard = () => {
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
        <Zap className="h-10 w-10 text-accent" />
        <h1 className="font-serif text-3xl font-bold">ProngGSD</h1>
        <p className="text-muted-foreground text-sm max-w-md">
          The learning orchestrator is being built. Check back soon.
        </p>
      </div>
    </Layout>
  );
};

export default Dashboard;
