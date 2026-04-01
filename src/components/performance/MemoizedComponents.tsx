import React, { memo } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';

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

function areGillerPropsEqual(prev: GillerProfileCardProps, next: GillerProfileCardProps): boolean {
  return (
    prev.giller.id === next.giller.id &&
    prev.giller.name === next.giller.name &&
    prev.giller.rating === next.giller.rating &&
    prev.giller.completedDeliveries === next.giller.completedDeliveries &&
    prev.giller.estimatedTime === next.giller.estimatedTime &&
    prev.giller.fee === next.giller.fee &&
    prev.isAccepting === next.isAccepting &&
    prev.isRejecting === next.isRejecting
  );
}

export const GillerProfileCard = memo(function GillerProfileCard({
  giller,
  onAccept,
  onReject,
  isAccepting = false,
  isRejecting = false,
}: GillerProfileCardProps) {
  return (
    <View style={styles.container}>
      <View style={styles.imageContainer}>
        {giller.profileImage ? (
          <Image source={{ uri: giller.profileImage }} style={styles.profileImage} />
        ) : (
          <View style={styles.defaultAvatar}>
            <Icon name="person" size={48} color="#00BCD4" />
          </View>
        )}
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.name}>{giller.name}</Text>
        <View style={styles.ratingContainer}>
          <Icon name="star" size={20} color="#FFD700" />
          <Text style={styles.rating}>{giller.rating.toFixed(1)}</Text>
          <Text style={styles.deliveries}>완료 {giller.completedDeliveries}건</Text>
        </View>

        {typeof giller.estimatedTime === 'number' ? (
          <View style={styles.row}>
            <Icon name="schedule" size={18} color="#666" />
            <Text style={styles.rowText}>예상 소요 {Math.floor(giller.estimatedTime / 60)}분</Text>
          </View>
        ) : null}

        {typeof giller.fee === 'number' ? (
          <View style={styles.row}>
            <Icon name="payments" size={18} color="#4CAF50" />
            <Text style={styles.feeText}>수수료 {giller.fee.toLocaleString('ko-KR')}원</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          activeOpacity={0.7}
          disabled={isRejecting || isAccepting}
          onPress={onReject}
          style={[styles.button, styles.rejectButton, (isRejecting || isAccepting) && styles.buttonDisabled]}
        >
          <Text style={styles.rejectButtonText}>거절</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          disabled={isAccepting || isRejecting}
          onPress={onAccept}
          style={[styles.button, styles.acceptButton, (isAccepting || isRejecting) && styles.buttonDisabled]}
        >
          <Text style={styles.acceptButtonText}>{isAccepting ? '수락 중...' : '수락'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}, areGillerPropsEqual);

interface RouteItemProps {
  route: {
    id: string;
    startStation: { name: string };
    endStation: { name: string };
    departureTime: string;
    daysOfWeek: number[];
    isActive: boolean;
  };
  onPress: (routeId: string) => void;
  onEdit: (routeId: string) => void;
  onDelete: (routeId: string) => void;
}

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const;

export const RouteItem = memo(function RouteItem({ route, onDelete, onEdit, onPress }: RouteItemProps) {
  const dayLabels = route.daysOfWeek
    .map((day) => DAY_LABELS[day - 1] ?? '')
    .filter(Boolean)
    .join(', ');

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={() => onPress(route.id)} style={styles.routeContainer}>
      <View style={styles.routeInfo}>
        <Text style={styles.routeText}>
          {route.startStation.name} → {route.endStation.name}
        </Text>
        <Text style={styles.routeSubtext}>
          {route.departureTime} | {dayLabels}
        </Text>
      </View>

      <View style={styles.routeActions}>
        <TouchableOpacity onPress={() => onEdit(route.id)}>
          <Icon name="edit" size={20} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onDelete(route.id)}>
          <Icon name="delete" size={20} color="#FF5252" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});

interface RequestCardProps {
  request: {
    id: string;
    pickupStation: { name: string };
    deliveryStation: { name: string };
    packageInfo: {
      size: string;
      weight: string;
    };
    fee: {
      totalFee: number;
    };
    status: string;
    createdAt: Date;
  };
  onPress: (requestId: string) => void;
  onAccept: (requestId: string) => void;
}

export const RequestCard = memo(function RequestCard({ request, onPress }: RequestCardProps) {
  const statusColor = (() => {
    switch (request.status) {
      case 'pending':
        return '#FF9800';
      case 'matched':
        return '#00BCD4';
      case 'in_progress':
        return '#4CAF50';
      case 'completed':
        return '#666';
      default:
        return '#666';
    }
  })();

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={() => onPress(request.id)} style={styles.requestContainer}>
      <View style={styles.requestHeader}>
        <Text style={styles.requestText}>
          {request.pickupStation.name} → {request.deliveryStation.name}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{request.status}</Text>
        </View>
      </View>

      <View style={styles.requestDetails}>
        <Text style={styles.requestSubtext}>
          {request.packageInfo.size} | {request.packageInfo.weight}
        </Text>
        <Text style={styles.requestFee}>{request.fee.totalFee.toLocaleString('ko-KR')}원</Text>
      </View>
    </TouchableOpacity>
  );
});

interface OptimizedFlatListProps<T> {
  data: readonly T[] | null | undefined;
  renderItem: ({ item, index }: { item: T; index: number }) => React.ReactElement | null;
  keyExtractor: (item: T, index: number) => string;
  [key: string]: unknown;
}

export function OptimizedFlatList<T>({ data, keyExtractor, renderItem, ...rest }: OptimizedFlatListProps<T>) {
  return (
    <FlatList
      data={data ?? []}
      initialNumToRender={10}
      keyExtractor={keyExtractor}
      maxToRenderPerBatch={10}
      removeClippedSubviews
      renderItem={renderItem}
      updateCellsBatchingPeriod={50}
      windowSize={5}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 4,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImage: {
    borderColor: '#00BCD4',
    borderRadius: 50,
    borderWidth: 3,
    height: 100,
    width: 100,
  },
  defaultAvatar: {
    alignItems: 'center',
    backgroundColor: '#E0F7FA',
    borderColor: '#00BCD4',
    borderRadius: 50,
    borderWidth: 3,
    height: 100,
    justifyContent: 'center',
    width: 100,
  },
  infoContainer: {
    marginBottom: 20,
  },
  name: {
    color: '#333',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  ratingContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
  },
  rating: {
    color: '#333',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
    marginRight: 16,
  },
  deliveries: {
    color: '#666',
    fontSize: 14,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  rowText: {
    color: '#666',
    fontSize: 16,
    marginLeft: 8,
  },
  feeText: {
    color: '#4CAF50',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  rejectButton: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
    borderWidth: 1,
  },
  rejectButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  acceptButton: {
    backgroundColor: '#00BCD4',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  routeContainer: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  routeInfo: {
    flex: 1,
  },
  routeText: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
  },
  routeSubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 4,
  },
  routeActions: {
    flexDirection: 'row',
    gap: 16,
  },
  requestContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 2,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  requestHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  requestText: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  requestDetails: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  requestSubtext: {
    color: '#666',
    fontSize: 14,
  },
  requestFee: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
