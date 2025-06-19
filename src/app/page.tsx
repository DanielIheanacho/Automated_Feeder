
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Zap } from 'lucide-react';

export default function HomePage() {
  const authors = ["Iheanacho Daniel", "Alao David", "Alabi Samuel"];
  const portraitImageHints = ["developer portrait", "student profile", "coder image"];

  return (
    <div className="flex flex-col items-center justify-center">
      <Card className="w-full max-w-3xl shadow-xl">
        <CardHeader className="text-center">
          <div className="inline-block p-3 bg-primary/10 rounded-full mb-4 mx-auto">
            <Zap className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="font-headline text-4xl text-primary">Welcome to AquaFeed!</CardTitle>
          <CardDescription className="text-lg text-foreground/80">
            Your smart solution for automated fish feeding.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <p className="text-center text-foreground/90 leading-relaxed px-4">
            Designed by Iheanacho Daniel, Alao David, and Alabi Samuel.
            This application was developed as part of our project work to facilitate interaction with an automated fish feeder system through IoT. It enables users to monitor and control the feeding operations of the system remotely and efficiently. Communication between the app and the microcontroller is achieved using the MQTT protocol, which ensures low-latency data transfer and real-time responsiveness. The microcontroller, in turn, manages all the mechanical and operational aspects of the feeder.
          </p>
          
          <div className="w-full px-4">
            <div className="relative w-full rounded-lg overflow-hidden shadow-md aspect-[16/9]">
              <Image
                src="https://placehold.co/800x450.png"
                alt="Project Team Outdoors"
                layout="fill"
                objectFit="cover"
                data-ai-hint="group photo outdoors"
                className="transform hover:scale-105 transition-transform duration-300"
              />
            </div>
          </div>

          <div className="mt-8 px-2">
            <h3 className="text-2xl font-headline text-primary text-center mb-6">Meet the Authors</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {authors.map((author, index) => (
                <div key={author} className="flex flex-col items-center text-center">
                  <div className="relative w-full max-w-[250px] aspect-[2/3] rounded-lg overflow-hidden shadow-md mb-3">
                    <Image
                      src={`https://placehold.co/260x390.png`}
                      alt={`Portrait of ${author}`}
                      layout="fill"
                      objectFit="cover"
                      data-ai-hint={portraitImageHints[index % portraitImageHints.length]}
                      className="transform hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <p className="font-semibold text-foreground/90">{author}</p>
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex justify-center pt-6">
            <Link href="/schedule" passHref>
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                Get Started
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
