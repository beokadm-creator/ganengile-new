import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const { width } = Dimensions.get('window');

interface GillerProfileCardProps {
  giller: {
    id: string;
    name: string;
    profileImage?: string;
    rating: number;
    completedDeliveries: number;
    estimatedTime?: number;
    fee?: number;
  };
  onAccept: () => void;
  onReject: () => void;
  isAccepting?: boolean;
  isRejecting?: boolean;
}

export const GillerProfileCard: React.FC<GillerProfileCardProps> = ({
  giller,
  onAccept,
  onReject,
  isAccepting = false,
  isRejecting = false,
}) => {
  return (
    <View style={styles.container}>
      {/* Profile Image */}
      <View style={styles.imageContainer}>
        {giller.profileImage ? (
          <Image
            source={{ uri: giller.profileImage }}
            style={styles.profileImage}
          />
        ) : (
          <View style={styles.defaultAvatar}>
            <Icon name="person" size={48} color="#00BCD4" />
          </View>
        )}
      </View>

      {/* Giller Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.name}>{giller.name}</Text>

        {/* Rating */}
        <View style={styles.ratingContainer}>
          <Icon name="star" size={20} color="#FFD700" />
          <Text style={styles.rating}>{giller.rating.toFixed(1)}</Text>
          <Text style={styles.deliveries}>
            완료 {giller.completedDeliveries}건
          </Text>
        </View>

        {/* Estimated Time */}
        {giller.estimatedTime && (
          <View style={styles.row}>
            <Icon name="schedule" size={18} color="#666" />
            <Text style={styles.rowText}>
              예상 소요시간 {Math.floor(giller.estimatedTime / 60)}분
            </Text>
          </View>
        )}

        {/* Fee */}
        {giller.fee && (
          <View style={styles.row}>
            <Icon name="payments" size={18} color="#4CAF50" />
            <Text style={styles.feeText}>수수료 {giller.fee.toLocaleString()}원</Text>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.rejectButton, isRejecting && styles.buttonDisabled]}
          onPress={onReject}
          disabled={isRejecting || isAccepting}
          activeOpacity={0.7}
        >
          <Text style={styles.rejectButtonText}>거절</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.acceptButton, isAccepting && styles.buttonDisabled]}
          onPress={onAccept}
          disabled={isAccepting || isRejecting}
          activeOpacity={0.7}
        >
          {isAccepting ? (
            <Text style={styles.acceptButtonText}>수락 중...</Text>
          ) : (
            <Text style={styles.acceptButtonText}>수락</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#00BCD4',
  },
  defaultAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E0F7FA',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#00BCD4',
  },
  infoContainer: {
    marginBottom: 20,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  rating: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
    marginRight: 16,
  },
  deliveries: {
    fontSize: 14,
    color: '#666',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  rowText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 8,
  },
  feeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginLeft: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButton: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  rejectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  acceptButton: {
    backgroundColor: '#00BCD4',
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
