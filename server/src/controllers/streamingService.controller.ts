import { Request, Response } from 'express';
import StreamingService from '../models/StreamingService';
import UserStreamingService from '../models/UserStreamingService';
import { AuthedRequest } from '../middleware/auth';

class StreamingServiceController {
  // GET /api/streaming-services - Get all available streaming services
  async getAllServices(req: Request, res: Response) {
    try {
      const services = await StreamingService.find()
        .sort({ displayPriority: -1, name: 1 })
        .lean();
      
      res.json({
        success: true,
        data: services,
      });
    } catch (error) {
      console.error('Error fetching streaming services:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch streaming services',
      });
    }
  }

  // GET /api/users/me/streaming-services - Get user's selected services
  async getUserServices(req: AuthedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      
      const userServices = await UserStreamingService.find({ userId })
        .populate('streamingServiceId')
        .lean();
      
      res.json({
        success: true,
        data: userServices.map((us: any) => us.streamingServiceId),
      });
    } catch (error) {
      console.error('Error fetching user streaming services:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user streaming services',
      });
    }
  }

  // POST /api/users/me/streaming-services - Add a streaming service to user
  async addUserService(req: AuthedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { streamingServiceId } = req.body;

      if (!streamingServiceId) {
        return res.status(400).json({
          success: false,
          message: 'streamingServiceId is required',
        });
      }

      // Check if service exists
      const service = await StreamingService.findById(streamingServiceId);
      if (!service) {
        return res.status(404).json({
          success: false,
          message: 'Streaming service not found',
        });
      }

      // Check if already added
      const existing = await UserStreamingService.findOne({
        userId,
        streamingServiceId,
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'Streaming service already added',
        });
      }

      // Add service
      await UserStreamingService.create({
        userId,
        streamingServiceId,
      });

      res.status(201).json({
        success: true,
        message: 'Streaming service added successfully',
        data: service,
      });
    } catch (error) {
      console.error('Error adding user streaming service:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add streaming service',
      });
    }
  }

  // DELETE /api/users/me/streaming-services/:id - Remove a streaming service
  async removeUserService(req: AuthedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const deleted = await UserStreamingService.findOneAndDelete({
        userId,
        streamingServiceId: id,
      });

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Streaming service not found in user list',
        });
      }

      res.json({
        success: true,
        message: 'Streaming service removed successfully',
      });
    } catch (error) {
      console.error('Error removing user streaming service:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to remove streaming service',
      });
    }
  }

  // POST /api/admin/streaming-services/seed - Seed initial streaming services
  async seedServices(req: Request, res: Response) {
    try {
      // Popular US streaming services
      const services = [
        { tmdbProviderId: 8, name: 'Netflix', displayPriority: 10 },
        { tmdbProviderId: 9, name: 'Amazon Prime Video', displayPriority: 9 },
        { tmdbProviderId: 337, name: 'Disney Plus', displayPriority: 8 },
        { tmdbProviderId: 384, name: 'HBO Max', displayPriority: 7 },
        { tmdbProviderId: 15, name: 'Hulu', displayPriority: 6 },
        { tmdbProviderId: 350, name: 'Apple TV Plus', displayPriority: 5 },
        { tmdbProviderId: 531, name: 'Paramount Plus', displayPriority: 4 },
        { tmdbProviderId: 387, name: 'Peacock', displayPriority: 3 },
      ];

      for (const service of services) {
        await StreamingService.findOneAndUpdate(
          { tmdbProviderId: service.tmdbProviderId },
          service,
          { upsert: true, new: true }
        );
      }

      const count = await StreamingService.countDocuments();

      res.json({
        success: true,
        message: `Seeded ${services.length} streaming services`,
        total: count,
      });
    } catch (error) {
      console.error('Error seeding streaming services:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to seed streaming services',
      });
    }
  }
}

export default new StreamingServiceController();