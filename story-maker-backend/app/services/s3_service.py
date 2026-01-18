import os
import boto3
from botocore.exceptions import ClientError

class S3Service:
    def __init__(self):
        self.bucket_name = os.getenv("BUCKET_NAME")
        self.region = os.getenv("AWS_REGION", "us-east-2")

        # Initialize S3 client
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=os.getenv("S3_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("S3_SECRET_ACCESS_KEY"),
            region_name=self.region
        )

        if not self.bucket_name:
            raise ValueError("BUCKET_NAME environment variable is not set")

    def upload_image(self, file_bytes: bytes, file_name: str, content_type: str = "image/png") -> str:
        """
        Upload image to S3 and return public URL

        Args:
            file_bytes: Image file bytes
            file_name: Name for the file in S3
            content_type: MIME type of the image

        Returns:
            public_url: Public URL of the uploaded image
        """
        try:
            # Upload to S3 without ACL (bucket must have public access policy configured)
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=file_name,
                Body=file_bytes,
                ContentType=content_type
            )

            # Generate public URL
            public_url = f"https://{self.bucket_name}.s3.{self.region}.amazonaws.com/{file_name}"
            print(f"✅ Image uploaded to S3: {public_url}")
            return public_url

        except ClientError as e:
            print(f"❌ S3 upload error: {e}")
            raise Exception(f"Failed to upload to S3: {e}")

    def upload_audio_data(self, audio_data: bytes, filename: str, folder: str = "", content_type: str = "audio/mpeg") -> str:
        """
        Upload audio data to S3 and return public URL

        Args:
            audio_data: Audio file bytes
            filename: Name for the file in S3
            folder: Optional folder path (e.g., "voice_previews")
            content_type: MIME type of the audio

        Returns:
            public_url: Public URL of the uploaded audio
        """
        try:
            # Create full key with folder if provided
            key = f"{folder}/{filename}" if folder else filename

            # Upload to S3
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=key,
                Body=audio_data,
                ContentType=content_type
            )

            # Generate public URL
            public_url = f"https://{self.bucket_name}.s3.{self.region}.amazonaws.com/{key}"
            print(f"✅ Audio uploaded to S3: {public_url}")
            return public_url

        except ClientError as e:
            print(f"❌ S3 upload error: {e}")
            raise Exception(f"Failed to upload audio to S3: {e}")

    def upload_video_data(self, video_data: bytes, filename: str, folder: str = "", content_type: str = "video/mp4") -> str:
        """
        Upload video data to S3 and return public URL

        Args:
            video_data: Video file bytes
            filename: Name for the file in S3
            folder: Optional folder path (e.g., "final_videos")
            content_type: MIME type of the video

        Returns:
            public_url: Public URL of the uploaded video
        """
        try:
            # Create full key with folder if provided
            key = f"{folder}/{filename}" if folder else filename

            # Upload to S3
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=key,
                Body=video_data,
                ContentType=content_type
            )

            # Generate public URL
            public_url = f"https://{self.bucket_name}.s3.{self.region}.amazonaws.com/{key}"
            print(f"✅ Video uploaded to S3: {public_url}")
            return public_url

        except ClientError as e:
            print(f"❌ S3 upload error: {e}")
            raise Exception(f"Failed to upload video to S3: {e}")

    def delete_image(self, file_name: str):
        """Delete image from S3"""
        try:
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=file_name
            )
            print(f"🗑️ Deleted from S3: {file_name}")
        except ClientError as e:
            print(f"❌ S3 delete error: {e}")


# Global instance
s3_service = S3Service()
