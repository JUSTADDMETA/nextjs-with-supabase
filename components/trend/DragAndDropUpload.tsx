'use client';

import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'framer-motion';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Video = {
  file_name: string;
  title: string;
  description: string;
  categories: string[];
  videoUrl: string;
};

export default function DragAndDropUpload() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState('');
  const [videos, setVideos] = useState<Video[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showSlider, setShowSlider] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
      setUploadProgress(0);
    }
  }, []);

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);

    const s3Client = new S3Client({
      forcePathStyle: true,
      region: 'eu-central-1',
      endpoint: 'https://ddbyrpmrexntgqszrays.supabase.co/storage/v1/s3',
      credentials: {
        accessKeyId: '00a9a23344167d67a5a5f3fd9b2c69a1',
        secretAccessKey: '2b77d2e902a9584f44ebd984a2d1b30ae592d1462b76a13889e9c4a9e183e476',
      }
    });

    const fileExt = selectedFile.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExt}`;

    try {
      const command = new PutObjectCommand({
        Bucket: 'videos',
        Key: fileName,
        Body: selectedFile,
      });

      // Simulate progress
      const interval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 10;
        });
      }, 100);

      await s3Client.send(command);

      const { error } = await supabase
        .from('videos')
        .insert([
          {
            file_name: fileName,
            title,
            description,
            categories: JSON.stringify(categories.split(','))
          }
        ]);

      if (error) {
        console.error('Fehler beim Speichern der Metadaten:', error);
      } else {
        setVideos(prevVideos => [
          ...prevVideos,
          {
            file_name: fileName,
            title,
            description,
            categories: categories.split(','),
            videoUrl: `https://ddbyrpmrexntgqszrays.supabase.co/storage/v1/object/public/videos/${fileName}`
          }
        ]);
        setTitle('');
        setDescription('');
        setCategories('');
        setSelectedFile(null);
      }
    } catch (error) {
      console.error('Fehler beim Hochladen der Datei:', error);
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('videos')
      .select('*');

    if (error) {
      console.error('Fehler beim Abrufen der Videos:', error);
    } else {
      const parsedData = data.map((video: any) => ({
        ...video,
        categories: JSON.parse(video.categories),
        videoUrl: `https://ddbyrpmrexntgqszrays.supabase.co/storage/v1/object/public/videos/${video.file_name}`
      }));
      setVideos(parsedData);
    }
    setIsLoading(false);
  };

  const handleNextVideo = () => {
    setIsLoading(true);
    setCurrentVideoIndex((prevIndex) => (prevIndex + 1) % videos.length);
    setTimeout(() => setIsLoading(false), 500); // Simulate loading time
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <div className="flex flex-col items-center justify-between text-black gap-8">
      <section className="w-full max-w-md p-4 border-b-2 border-gray-300 border rounded">
        <h2 className="text-lg font-bold mb-4">Video Upload</h2>
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Titel"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded bg-gray-800 text-white"
          />
          <textarea
            placeholder="Beschreibung"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded bg-gray-800 text-white"
          />
          <input
            type="text"
            placeholder="Kategorien (kommagetrennt)"
            value={categories}
            onChange={(e) => setCategories(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded bg-gray-800 text-white"
          />
        </div>

        <div
          {...getRootProps()}
          className={`mt-4 p-8 border-2 border-dashed rounded-lg text-center cursor-pointer ${
            isDragActive ? 'border-black bg-gray-100' : 'border-gray-300'
          }`}
        >
          <input {...getInputProps()} />
          {isDragActive ? (
            <p >Dateien hier ablegen ...</p>
          ) : (
            <p className="text-white">Dateien hier hineinziehen oder klicken, um Dateien auszuwählen</p>
          )}
        </div>
        
        <div className="mt-2 text-center">
          <button
            onClick={handleUpload}
            className={`w-full mt-2 p-2 bg-black text-white border border-gray-200 rounded ${isUploading || !selectedFile ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isUploading || !selectedFile}
          >
            Hochladen
          </button>
          {isUploading && (
            <div className="mt-2">
              <progress value={uploadProgress} max="100" className="w-full"></progress>
            </div>
          )}
        </div>
      </section>

      <section className="h-screen flex-1 flex items-center justify-center w-full">
        {!showSlider ? (
               <section className="h-screen flex-1 flex items-center justify-center w-full">
          <button
            onClick={() => setShowSlider(true)}
            className="p-4 bg-black text-white rounded"
          >
            Inspire Me
          </button>
          </section>
        ) : (
          <div className="card p-4 border border-gray-300 rounded-lg shadow-md text-center text-gray-200">
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="spinner"
                  className="spinner border-t-4 border-b-4 border-gray-900 rounded-full w-12 h-12 animate-spin"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                ></motion.div>
              ) : (
                videos.length > 0 && (
                  <motion.div
                    key={videos[currentVideoIndex].file_name}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    <strong>{videos[currentVideoIndex].title}</strong> - {videos[currentVideoIndex].description} <br />
                    Kategorien: {videos[currentVideoIndex].categories.join(', ')} <br />
                    <div className="video-container">
                      <video src={videos[currentVideoIndex].videoUrl} controls className="mt-2 w-full h-auto" style={{ aspectRatio: '9/16' }} />
                    </div>
                  </motion.div>
                )
              )}
            </AnimatePresence>
          </div>
        )}
      </section>

      {showSlider && (
        <button
          onClick={handleNextVideo}
          className="mb-4 p-2 bg-black text-white rounded"
        >
          Nächstes Video
        </button>
      )}
    </div>
  );
}